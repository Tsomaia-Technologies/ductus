/**
 * PlanningProcessor - The Architect (Prefrontal Cortex).
 * Drives PlannerAgent, governs negotiation phase, yields REQUEST_INPUT for human approval.
 * RFC-001 Task 017-planning-processor, Rev 06 Section 5.2.
 */

import { randomUUID } from "node:crypto";
import type { BaseEvent } from "../core/event-contracts.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { EventQueue } from "../interfaces/event-queue.js";

interface PlanningProcessorHub {
  broadcast(base: BaseEvent): Promise<void>;
}

interface StartPlanningPayload {
  prompt?: string;
}

interface InputReceivedPayload {
  id?: string;
  answer?: unknown;
}

const AUTHOR_ID = "planning-processor";
const PLANNER_ROLE = "planner";

function isApproval(answer: unknown): boolean {
  if (typeof answer === "boolean") return answer;
  if (typeof answer === "string") {
    const s = answer.trim().toLowerCase();
    return s === "yes" || s === "y" || s === "true" || s === "1";
  }
  return false;
}

export class PlanningProcessor implements EventProcessor {
  /** Maps REQUEST_INPUT id → draft spec for INPUT_RECEIVED correlation. */
  private readonly pendingByRequestId = new Map<string, string>();

  constructor(
    private readonly hub: PlanningProcessorHub,
    public readonly incomingQueue: EventQueue
  ) {}

  process(stream: InputEventStream): OutputEventStream {
    return this.consumeAndOrchestrate(stream);
  }

  private async *consumeAndOrchestrate(
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
      if (event.type === "START_PLANNING") {
        if (event.isReplay) continue;
        yield* this.handleStartPlanning(event);
        continue;
      }

      if (event.type === "AGENT_REPORT_RECEIVED") {
        if (event.isReplay) continue;
        yield* this.handleAgentReport(event);
        continue;
      }

      if (event.type === "INPUT_RECEIVED") {
        if (event.isReplay) continue;
        yield* this.handleInputReceived(event);
      }
    }
  }

  private async *handleStartPlanning(event: {
    payload: unknown;
    eventId?: string;
  }): OutputEventStream {
    const payload = event.payload as StartPlanningPayload;
    const prompt = typeof payload?.prompt === "string" ? payload.prompt : "";

    void this.hub.broadcast({
      type: "EFFECT_SPAWN_AGENT",
      payload: {
        roleName: PLANNER_ROLE,
        scope: "default",
        input: prompt,
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now(),
      volatility: "durable-draft",
    });
  }

  private async *handleAgentReport(event: {
    payload: unknown;
    authorId: string;
    eventId?: string;
  }): OutputEventStream {
    if (event.authorId !== "agent-processor") return;

    const p = event.payload;
    if (typeof p === "object" && p !== null && "files" in p) return;

    const spec =
      typeof p === "string" ? p : (p as { spec?: string })?.spec ?? "";

    if (typeof spec !== "string" || spec.length === 0) return;

    const requestId = `approve-spec-${randomUUID()}`;
    this.pendingByRequestId.set(requestId, spec);

    void this.hub.broadcast({
      type: "REQUEST_INPUT",
      payload: {
        id: requestId,
        question: "Approve this spec? Reply 'Yes' to approve, or describe the changes you want (e.g. 'No, add authentication').",
        expectedSchemaType: "string",
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now(),
      volatility: "durable-draft",
    });
  }

  private async *handleInputReceived(event: {
    payload: unknown;
    authorId: string;
  }): OutputEventStream {
    const payload = event.payload as InputReceivedPayload;
    const id = payload?.id ?? "";
    const answer = payload?.answer;

    const spec = this.pendingByRequestId.get(id);
    if (!spec) return;

    this.pendingByRequestId.delete(id);

    if (isApproval(answer)) {
      void this.hub.broadcast({
        type: "PLAN_APPROVED",
        payload: { spec },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "durable-draft",
      });
      return;
    }

    void this.hub.broadcast({
      type: "PLAN_REJECTED",
      payload: { spec, feedback: typeof answer === "string" ? answer : String(answer ?? "") },
      authorId: AUTHOR_ID,
      timestamp: Date.now(),
      volatility: "durable-draft",
    });

    const feedback = typeof answer === "string" ? answer : String(answer ?? "");
    void this.hub.broadcast({
      type: "EFFECT_SPAWN_AGENT",
      payload: {
        roleName: PLANNER_ROLE,
        scope: "default",
        input: feedback,
        context: {
          messages: [
            {
              role: "user" as const,
              content: `Previous spec was rejected. User feedback: ${feedback}`,
              timestamp: Date.now(),
            },
          ],
          stats: { inputTokens: 0, outputTokens: 0, turns: 0 },
        },
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now(),
      volatility: "durable-draft",
    });
  }
}
