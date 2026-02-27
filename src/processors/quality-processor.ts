/**
 * QualityProcessor - The Feature Reviewer (Final Gatekeeper).
 * Runs per_feature checks (E2E, type-check), optionally spawns Auditor agent.
 * RFC-001 Task 018-quality-processor, Rev 06 Section 8.2.
 */

import { randomUUID } from "node:crypto";
import type { BaseEvent } from "../interfaces/event.js";
import type { DuctusConfig } from "../core/ductus-config-schema.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import { RingBufferQueue } from "../core/event-queue.js";
import { createEffectRunTool, createEffectSpawnAgent, createFeatureRejected, createFeatureApproved } from "../core/events/creators.js";

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

interface PendingFeatureVerification {
  spec?: string;
  scope?: string;
  remainingChecks: [string, { command: string; boundary: string }][];
}

interface PendingAuditorVerification {
  spec?: string;
}

const AUTHOR_ID = "quality-processor";

function parseCommandToExec(commandStr: string): { command: string; args: string[] } {
  const parts = commandStr.split(/\s+/).filter((s) => s.length > 0);
  const command = parts[0] ?? "";
  const args = parts.slice(1);
  return { command, args };
}

export class QualityProcessor implements EventProcessor {
  private readonly pendingByTrackingId = new Map<string, PendingFeatureVerification>();
  private readonly pendingAuditorByCorrelationId = new Map<string, PendingAuditorVerification>();
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

  private getPerFeatureChecks(scopeName?: string): [string, { command: string; boundary: string }][] {
    const scope =
      !scopeName || scopeName === "default"
        ? this.config.default
        : this.config.scopes?.[scopeName] ?? this.config.default;
    const checks = scope?.checks ?? {};
    const entries: [string, { command: string; boundary: string }][] = [];
    for (const k of Object.keys(checks)) {
      const c = checks[k];
      if (c && c.boundary === "per_feature") {
        entries.push([k, { command: c.command, boundary: c.boundary }]);
      }
    }
    return entries;
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
      if (event.type === "FEATURE_IMPLEMENTED") {
        if (event.isReplay) continue;
        this.handleFeatureImplemented(event);
        continue;
      }

      if (event.type === "TOOL_COMPLETED") {
        if (event.authorId !== "tool-processor") continue;
        this.handleToolCompleted(event.payload as ToolCompletedPayload);
        continue;
      }

      if (event.type === "TOOL_FAILED") {
        if (event.authorId !== "tool-processor") continue;
        this.handleToolFailed(event.payload as ToolFailedPayload);
        continue;
      }

      if (event.type === "AGENT_RESPONSE") {
        if ((event as any).isReplay === true) continue;
        this.handleAgentReport(event);
      }
    }
    this.outQueue.close();
  }

  private handleFeatureImplemented(event: {
    payload: unknown;
    eventId?: string;
  }): void {
    const payload = event.payload as { spec?: string; scope?: string };
    const scope = payload?.scope ?? "default";

    const checks = this.getPerFeatureChecks(scope);
    if (checks.length === 0) {
      this.spawnAuditor(payload?.spec, scope);
      return;
    }

    const [, firstCheck] = checks[0]!;
    const { command, args } = parseCommandToExec(firstCheck.command);
    const trackingId = `qa-feature-${randomUUID()}`;

    const pending: PendingFeatureVerification = {
      spec: payload?.spec,
      scope,
      remainingChecks: checks.slice(1),
    };
    this.pendingByTrackingId.set(trackingId, pending);

    this.outQueue.push(createEffectRunTool({
      payload: {
        command,
        args,
        cwd: this.cwd,
        trackingId,
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now()
    }));
  }

  private handleToolCompleted(payload: ToolCompletedPayload): void {
    const trackingId = payload?.trackingId as string | undefined;
    if (!trackingId) return;

    const pending = this.pendingByTrackingId.get(trackingId);
    if (!pending) return;

    this.pendingByTrackingId.delete(trackingId);

    const remaining = pending.remainingChecks;
    if (remaining.length > 0) {
      const [, nextCheck] = remaining[0]!;
      const { command, args } = parseCommandToExec(nextCheck.command);
      const nextTrackingId = `qa-feature-${randomUUID()}`;
      this.pendingByTrackingId.set(nextTrackingId, {
        ...pending,
        remainingChecks: remaining.slice(1),
      });

      this.outQueue.push(createEffectRunTool({
        payload: {
          command,
          args,
          cwd: this.cwd,
          trackingId: nextTrackingId,
        },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }));
      return;
    }

    this.spawnAuditor(pending.spec, pending.scope);
  }

  private spawnAuditor(spec?: string, scope?: string): void {
    const correlationId = `qa-auditor-${randomUUID()}`;
    this.pendingAuditorByCorrelationId.set(correlationId, { spec });

    this.outQueue.push(createEffectSpawnAgent({
      payload: {
        roleName: "auditor",
        scope: scope ?? "default",
        input: spec ?? "",
        correlationId,
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now()
    }));
  }

  private handleToolFailed(payload: ToolFailedPayload): void {
    const trackingId = payload?.trackingId as string | undefined;
    if (!trackingId) return;

    const pending = this.pendingByTrackingId.get(trackingId);
    if (!pending) return;

    this.pendingByTrackingId.delete(trackingId);

    this.outQueue.push(createFeatureRejected({
      payload: {
        reason: "check_failure",
        stderr: payload?.stderr ?? payload?.log ?? "",
        log: payload?.log ?? "",
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now()
    }));
  }

  private handleAgentReport(event: {
    payload: unknown;
    authorId: string;
  }): void {
    if (event.authorId !== "agent-processor") return;
    const raw = event.payload;
    const correlationId =
      raw !== null && typeof raw === "object" && "correlationId" in raw
        ? (raw as { correlationId?: string }).correlationId
        : undefined;
    if (!correlationId) return;

    const pending = this.pendingAuditorByCorrelationId.get(correlationId);
    if (!pending) return;

    this.pendingAuditorByCorrelationId.delete(correlationId);

    const p =
      raw !== null &&
        typeof raw === "object" &&
        "result" in raw
        ? (raw as { result: unknown }).result
        : raw;
    const report =
      typeof p === "object" && p !== null && "approved" in p
        ? (p as { approved?: boolean; critique?: string })
        : null;

    const approved = report?.approved ?? false;
    const critique = report?.critique ?? "";

    if (!approved || critique.length > 0) {
      this.outQueue.push(createFeatureRejected({
        payload: { reason: "auditor_gaps", critique },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }));
    } else {
      this.outQueue.push(createFeatureApproved({
        payload: { spec: pending.spec },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }));
    }
  }
}
