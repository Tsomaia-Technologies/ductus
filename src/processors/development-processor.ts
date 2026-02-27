/**
 * DevelopmentProcessor - The Bouncer (Zero-Trust Loop).
 * Intercepts Agent reports, verifies claims via git diff, runs configured checks.
 * RFC-001 Task 016-development-processor, Rev 06 Section 5.3.
 */

import { randomUUID } from "node:crypto";
import type { BaseEvent } from "../core/event-contracts.js";
import type { DuctusConfig } from "../core/ductus-config-schema.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { EventQueue } from "../interfaces/event-queue.js";

interface DevelopmentProcessorHub {
  broadcast(base: BaseEvent): Promise<void>;
}

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

  constructor(
    private readonly hub: DevelopmentProcessorHub,
    private readonly config: DuctusConfig,
    private readonly cwd: string,
    public readonly incomingQueue: EventQueue
  ) {}

  process(stream: InputEventStream): OutputEventStream {
    return this.consumeAndVerify(stream);
  }

  private async *consumeAndVerify(
    stream: AsyncIterable<{
      type: string;
      payload: unknown;
      authorId: string;
      timestamp: number;
      eventId?: string;
      isReplay?: boolean;
    }>
  ): OutputEventStream {
    for await (const event of stream) {
      if (event.type === "AGENT_REPORT_RECEIVED") {
        if (event.isReplay) continue;
        yield* this.handleAgentReport(event);
        continue;
      }

      if (event.type === "TOOL_COMPLETED") {
        yield* this.handleToolCompleted(event.payload as ToolCompletedPayload, event.authorId);
        continue;
      }

      if (event.type === "TOOL_FAILED") {
        yield* this.handleToolFailed(event.payload as ToolFailedPayload, event.authorId);
      }
    }
  }

  private async *handleAgentReport(event: {
    payload: unknown;
    authorId: string;
    eventId?: string;
  }): OutputEventStream {
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

    void this.hub.broadcast({
      type: "EFFECT_RUN_TOOL",
      payload: {
        command: "git",
        args: ["diff", "--name-only"],
        cwd: this.cwd,
        trackingId,
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now(),
      volatility: "durable-draft",
    });
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

  private async *handleToolCompleted(
    payload: ToolCompletedPayload,
    toolAuthorId: string
  ): OutputEventStream {
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
        void this.hub.broadcast({
          type: "AUTO_REJECTION",
          payload: {
            reason: "diff_mismatch",
            isHallucination: true,
            detail: cmp.reason,
            authorId: pending.authorId,
          },
          authorId: AUTHOR_ID,
          timestamp: Date.now(),
          volatility: "durable-draft",
        });
        return;
      }

      const checks = this.getChecksForScope("default");
      if (checks.length === 0) {
        void this.hub.broadcast({
          type: "VALIDATION_SUCCESS",
          payload: { files: actualFiles },
          authorId: AUTHOR_ID,
          timestamp: Date.now(),
          volatility: "durable-draft",
        });
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

      void this.hub.broadcast({
        type: "EFFECT_RUN_TOOL",
        payload: {
          command,
          args,
          cwd: this.cwd,
          trackingId: nextTrackingId,
        },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "durable-draft",
      });
      return;
    }

    if (pending.phase === "check") {
      const exitCode = payload?.exitCode ?? 0;
      if (exitCode !== 0) {
        void this.hub.broadcast({
          type: "AUTO_REJECTION",
          payload: {
            reason: "check_failure",
            isHallucination: false,
            command: pending.checkCommand,
            stderr: payload?.stderr ?? payload?.log ?? "",
            checkName: pending.checkName,
            authorId: pending.authorId,
          },
          authorId: AUTHOR_ID,
          timestamp: Date.now(),
          volatility: "durable-draft",
        });
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

        void this.hub.broadcast({
          type: "EFFECT_RUN_TOOL",
          payload: {
            command,
            args,
            cwd: this.cwd,
            trackingId: nextTrackingId,
          },
          authorId: AUTHOR_ID,
          timestamp: Date.now(),
          volatility: "durable-draft",
        });
        return;
      }

      void this.hub.broadcast({
        type: "VALIDATION_SUCCESS",
        payload: { files: pending.verifiedFiles ?? [] },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "durable-draft",
      });
    }
  }

  private async *handleToolFailed(
    payload: ToolFailedPayload,
    toolAuthorId: string
  ): OutputEventStream {
    if (toolAuthorId !== "tool-processor") return;

    const trackingId = payload?.trackingId as string | undefined;
    if (!trackingId) return;

    const pending = this.pendingByTrackingId.get(trackingId);
    if (!pending) return;

    this.pendingByTrackingId.delete(trackingId);

    if (pending.phase === "git-diff") {
      void this.hub.broadcast({
        type: "AUTO_REJECTION",
        payload: {
          reason: "git_diff_failed",
          isHallucination: true,
          detail: payload?.stderr ?? payload?.log ?? "git diff failed",
          authorId: pending.authorId,
        },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "durable-draft",
      });
      return;
    }

    if (pending.phase === "check") {
      void this.hub.broadcast({
        type: "AUTO_REJECTION",
        payload: {
          reason: "check_failure",
          isHallucination: false,
          command: pending.checkCommand,
          stderr: payload?.stderr ?? payload?.log ?? "",
          checkName: pending.checkName,
          authorId: pending.authorId,
        },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "durable-draft",
      });
    }
  }
}
