/**
 * QualityProcessor - The Feature Reviewer (Final Gatekeeper).
 * Runs per_feature checks (E2E, type-check), optionally spawns Auditor agent.
 * RFC-001 Task 018-quality-processor, Rev 06 Section 8.2.
 */

import { randomUUID } from "node:crypto";
import type { BaseEvent } from "../core/event-contracts.js";
import type { DuctusConfig } from "../core/ductus-config-schema.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { EventQueue } from "../interfaces/event-queue.js";

interface QualityProcessorHub {
  broadcast(base: BaseEvent): Promise<void>;
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
  private readonly pendingAuditorByCorrelationId = new Map<
    string,
    PendingAuditorVerification
  >();

  constructor(
    private readonly hub: QualityProcessorHub,
    private readonly config: DuctusConfig,
    private readonly cwd: string,
    public readonly incomingQueue: EventQueue
  ) {}

  process(stream: InputEventStream): OutputEventStream {
    return this.consumeAndVerify(stream);
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
      if (event.type === "FEATURE_IMPLEMENTED") {
        if (event.isReplay) continue;
        yield* this.handleFeatureImplemented(event);
        continue;
      }

      if (event.type === "TOOL_COMPLETED") {
        if (event.authorId !== "tool-processor") continue;
        yield* this.handleToolCompleted(event.payload as ToolCompletedPayload);
        continue;
      }

      if (event.type === "TOOL_FAILED") {
        if (event.authorId !== "tool-processor") continue;
        yield* this.handleToolFailed(event.payload as ToolFailedPayload);
        continue;
      }

      if (event.type === "AGENT_REPORT_RECEIVED") {
        if (event.isReplay) continue;
        yield* this.handleAgentReport(event);
      }
    }
  }

  private async *handleFeatureImplemented(event: {
    payload: unknown;
    eventId?: string;
  }): OutputEventStream {
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

    void this.hub.broadcast({
      type: "EFFECT_RUN_TOOL",
      payload: {
        command,
        args,
        cwd: this.cwd,
        trackingId,
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now(),
      volatility: "durable-draft",
    });
  }

  private async *handleToolCompleted(payload: ToolCompletedPayload): OutputEventStream {
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

    this.spawnAuditor(pending.spec, pending.scope);
  }

  private spawnAuditor(spec?: string, scope?: string): void {
    const correlationId = `qa-auditor-${randomUUID()}`;
    this.pendingAuditorByCorrelationId.set(correlationId, { spec });

    void this.hub.broadcast({
      type: "EFFECT_SPAWN_AGENT",
      payload: {
        roleName: "auditor",
        scope: scope ?? "default",
        input: spec ?? "",
        correlationId,
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now(),
      volatility: "durable-draft",
    });
  }

  private async *handleToolFailed(payload: ToolFailedPayload): OutputEventStream {
    const trackingId = payload?.trackingId as string | undefined;
    if (!trackingId) return;

    const pending = this.pendingByTrackingId.get(trackingId);
    if (!pending) return;

    this.pendingByTrackingId.delete(trackingId);

    void this.hub.broadcast({
      type: "FEATURE_REJECTED",
      payload: {
        reason: "check_failure",
        stderr: payload?.stderr ?? payload?.log ?? "",
        log: payload?.log ?? "",
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now(),
      volatility: "durable-draft",
    });
  }

  private async *handleAgentReport(event: {
    payload: unknown;
    authorId: string;
  }): OutputEventStream {
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
      void this.hub.broadcast({
        type: "FEATURE_REJECTED",
        payload: { reason: "auditor_gaps", critique },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "durable-draft",
      });
    } else {
      void this.hub.broadcast({
        type: "FEATURE_APPROVED",
        payload: { spec: pending.spec },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "durable-draft",
      });
    }
  }
}
