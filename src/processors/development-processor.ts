/**
 * DevelopmentProcessor - The Bouncer (Zero-Trust Loop).
 * Intercepts Agent reports, verifies claims via git diff, runs configured checks.
 * RFC-001 Task 016-development-processor, Rev 06 Section 5.3.
 */

import { randomUUID } from "node:crypto";
import { RingBufferQueue } from "../core/event-queue.js";
import { createEffectRunTool, createAutoRejection, createFeatureApproved } from "../core/events/creators.js";
import { createTaskCompleted } from "../core/events/creators.js";

// Let me ensure we just use the named types from the type registry we set up.
// Specifically `REQUEST_TOOL`, `AUTO_REJECTION`, `TASK_COMPLETED`.

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import type { DuctusConfig } from "../core/ductus-config-schema.js";

interface AgentReportPayload {
  files?: string[];
}

interface ToolCompletedPayload {
  trackingId?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  log?: string;
}

interface ToolFailedPayload {
  trackingId?: string;
  exitCode?: number;
  stderr?: string;
  log?: string;
  reason?: string;
}

type PendingPhase = "git-diff" | "check";

interface PendingVerification {
  agentEventId: string;
  authorId: string;
  claimedFiles: string[];
  phase: PendingPhase;
  verifiedFiles?: string[];
  checkName?: string;
  checkCommand?: string;
  remainingChecks?: [string, { command: string; boundary: string }][];
}

const AUTHOR_ID = "development-processor";

function parseGitDiffLines(stdout: string): string[] {
  const lines = stdout.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i]!.trim();
    if (s.length > 0) out.push(s);
  }
  return out;
}

function interpolateFiles(command: string, files: string[]): string {
  const replacement = files.join(" ");
  return command.replace(/\{\{files\}\}/g, replacement);
}

function compareClaimsVsReality(
  claimed: string[],
  actual: string[]
): { match: boolean; reason?: string } {
  const claimedSet = new Set(claimed);
  const actualSet = new Set(actual);

  for (let i = 0; i < actual.length; i++) {
    const f = actual[i]!;
    if (!claimedSet.has(f)) {
      return {
        match: false,
        reason: `Hallucination: git diff reported "${f}" but Agent did not claim it`,
      };
    }
  }

  for (let i = 0; i < claimed.length; i++) {
    const f = claimed[i]!;
    if (!actualSet.has(f)) {
      return {
        match: false,
        reason: `Hallucination: Agent claimed "${f}" but git diff did not report it`,
      };
    }
  }

  return { match: true };
}

export class DevelopmentProcessor implements EventProcessor {
  private readonly pendingByTrackingId = new Map<string, PendingVerification>();
  private readonly outQueue = new RingBufferQueue<BaseEvent>(128);

  constructor(
    private readonly config: DuctusConfig,
    private readonly cwd: string
  ) { }

  async *process(stream: InputEventStream): OutputEventStream {
    this.consumeAndVerify(stream).catch(console.error);
    for await (const out of this.outQueue) {
      yield out;
    }
  }

  private async consumeAndVerify(
    stream: AsyncIterable<{
      type: string;
      payload: unknown;
      authorId: string;
      timestamp: number;
      eventId?: string;
      isReplay?: boolean;
    }>
  ): Promise<void> {
    for await (const event of stream) {
      if (event.type === "AGENT_RESPONSE") {
        if ((event as any).isReplay === true) continue;
        this.handleAgentReport(event);
        continue;
      }

      if (event.type === "TOOL_COMPLETED") {
        this.handleToolCompleted(event.payload as ToolCompletedPayload, event.authorId);
        continue;
      }

      if (event.type === "TOOL_FAILURE") {
        this.handleToolFailed(event.payload as ToolFailedPayload, event.authorId);
      }
    }
    this.outQueue.close();
  }

  private handleAgentReport(event: {
    payload: unknown;
    authorId: string;
    eventId?: string;
  }): void {
    const raw = event.payload;
    if (
      raw !== null &&
      typeof raw === "object" &&
      "correlationId" in raw
    ) {
      return;
    }
    const payload = raw as AgentReportPayload;
    const files = Array.isArray(payload?.files)
      ? payload.files
      : [];
    const agentEventId = event.eventId ?? "";
    const authorId = event.authorId ?? "";

    const trackingId = `dev-verify-${randomUUID()}`;
    this.pendingByTrackingId.set(trackingId, {
      agentEventId,
      authorId,
      claimedFiles: files,
      phase: "git-diff",
    });

    this.outQueue.push(createEffectRunTool({
      payload: {
        command: "git diff --name-only",
        args: [],
        cwd: this.cwd,
        trackingId,
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now()
    }));
  }

  private resolveScope(scopeName?: string): DuctusConfig["default"] {
    if (!scopeName || scopeName === "default") {
      return this.config.default;
    }
    const scope = this.config.scopes?.[scopeName];
    return scope ?? this.config.default;
  }

  private getChecksForScope(scopeName?: string): [string, { command: string; boundary: string }][] {
    const scope = this.resolveScope(scopeName);
    const checks = scope?.checks ?? {};
    const entries: [string, { command: string; boundary: string }][] = [];
    for (const k of Object.keys(checks)) {
      const c = checks[k];
      if (c && c.boundary === "per_iteration") {
        entries.push([k, { command: c.command, boundary: c.boundary }]);
      }
    }
    return entries;
  }

  private handleToolCompleted(
    payload: ToolCompletedPayload,
    toolAuthorId: string
  ): void {
    if (toolAuthorId !== "tool-processor") return;

    const trackingId = payload?.trackingId as string | undefined;
    if (!trackingId) return;

    const pending = this.pendingByTrackingId.get(trackingId);
    if (!pending) return;

    this.pendingByTrackingId.delete(trackingId);

    if (pending.phase === "git-diff") {
      const actualFiles = parseGitDiffLines(payload?.stdout ?? "");
      const cmp = compareClaimsVsReality(pending.claimedFiles, actualFiles);

      if (!cmp.match) {
        this.outQueue.push(createAutoRejection({
          payload: {
            isHallucination: true,
            type: cmp.reason
          },
          authorId: AUTHOR_ID,
          timestamp: Date.now()
        }));
        return;
      }

      const checks = this.getChecksForScope("default");
      if (checks.length === 0) {
        this.outQueue.push(createTaskCompleted({
          payload: { taskId: pending.agentEventId },
          authorId: AUTHOR_ID,
          timestamp: Date.now()
        }));
        return;
      }

      const [firstCheckName, firstCheck] = checks[0]!;
      const interpolated = interpolateFiles(firstCheck.command, actualFiles);
      const parts = interpolated.split(/\s+/).filter((s) => s.length > 0);
      const command = parts[0] ?? "";
      const args = parts.slice(1);

      const nextTrackingId = `dev-check-${randomUUID()}`;
      const nextPending: PendingVerification = {
        agentEventId: pending.agentEventId,
        authorId: pending.authorId,
        claimedFiles: pending.claimedFiles,
        phase: "check",
        verifiedFiles: actualFiles,
        checkName: firstCheckName,
        checkCommand: interpolated,
      };
      if (checks.length > 1) nextPending.remainingChecks = checks.slice(1);
      this.pendingByTrackingId.set(nextTrackingId, nextPending);

      this.outQueue.push(createEffectRunTool({
        payload: { command, args, cwd: this.cwd, trackingId: nextTrackingId },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }));
      return;
    }

    if (pending.phase === "check") {
      const exitCode = payload?.exitCode ?? 0;
      if (exitCode !== 0) {
        this.outQueue.push(createAutoRejection({
          payload: {
            isHallucination: false,
            type: "check_failure"
          },
          authorId: AUTHOR_ID,
          timestamp: Date.now()
        }));
        return;
      }

      const remaining = pending.remainingChecks;
      if (remaining && remaining.length > 0) {
        const [nextName, nextCheck] = remaining[0]!;
        const verified = pending.verifiedFiles ?? [];
        const interpolated = interpolateFiles(nextCheck.command, verified);
        const parts = interpolated.split(/\s+/).filter((s) => s.length > 0);
        const command = parts[0] ?? "";
        const args = parts.slice(1);

        const nextTrackingId = `dev-check-${randomUUID()}`;
        this.pendingByTrackingId.set(nextTrackingId, {
          ...pending,
          phase: "check",
          checkName: nextName,
          checkCommand: interpolated,
          remainingChecks: remaining.slice(1),
        });

        this.outQueue.push(createEffectRunTool({
          payload: { command, args, cwd: this.cwd, trackingId: nextTrackingId },
          authorId: AUTHOR_ID,
          timestamp: Date.now()
        }));
        return;
      }

      this.outQueue.push(createTaskCompleted({
        payload: { taskId: pending.agentEventId },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }));
    }
  }

  private handleToolFailed(
    payload: ToolFailedPayload,
    toolAuthorId: string
  ): void {
    if (toolAuthorId !== "tool-processor") return;

    const trackingId = payload?.trackingId as string | undefined;
    if (!trackingId) return;

    const pending = this.pendingByTrackingId.get(trackingId);
    if (!pending) return;

    this.pendingByTrackingId.delete(trackingId);

    if (pending.phase === "git-diff") {
      this.outQueue.push(createAutoRejection({
        payload: { isHallucination: true, type: "git_diff_failed" },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }));
      return;
    }

    if (pending.phase === "check") {
      this.outQueue.push(createAutoRejection({
        payload: { isHallucination: false, type: "check_failure" },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }));
    }
  }
}
