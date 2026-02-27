/**
 * PlanningProcessor - The Architect (Prefrontal Cortex).
 * Drives PlannerAgent, governs negotiation phase, yields REQUEST_INPUT for human approval.
 * RFC-001 Task 017-planning-processor, Rev 06 Section 5.2.
 */

import { randomUUID } from "node:crypto";
import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";

import { createEffectSpawnAgent, createRequestInput, createPlanApproved, createPlanRejected } from "../core/events/creators.js";

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
  constructor() { }

  async *process(stream: InputEventStream): OutputEventStream {
    for await (const event of stream) {
      if (event.type === "START_PLANNING") {
        if (event.isReplay) continue;
        yield* this.handleStartPlanning(event);
        continue;
      }

      if (event.type === "AGENT_RESPONSE") {
        if ((event as any).isReplay === true) continue;
        yield* this.handleAgentReport(event);
        continue;
      }

      if (event.type === "INPUT_RECEIVED") {
        if ((event as any).isReplay === true) continue;
        yield* this.handleInputReceived(event);
      }
    }
  }

  private handleStartPlanning(event: {
    payload: unknown;
    eventId?: string;
  }): BaseEvent[] {
    const payload = event.payload as StartPlanningPayload;
    const prompt = typeof payload?.prompt === "string" ? payload.prompt : "";

    return [
      createEffectSpawnAgent({
        payload: {
          roleName: PLANNER_ROLE,
          scope: "default",
          input: prompt,
        },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      })
    ];
  }

  private handleAgentReport(event: {
    payload: unknown;
    authorId: string;
    eventId?: string;
  }): BaseEvent[] {
    if (event.authorId !== "agent-processor") return [];

    const raw = event.payload;
    const p =
      raw !== null &&
        typeof raw === "object" &&
        "result" in raw &&
        "correlationId" in raw
        ? (raw as { result: unknown }).result
        : raw;
    if (typeof p === "object" && p !== null && "files" in p) return [];

    const spec =
      typeof p === "string" ? p : (p as { spec?: string })?.spec ?? "";

    if (typeof spec !== "string" || spec.length === 0) return [];

    const requestId = `approve-spec-${randomUUID()}`;
    this.pendingByRequestId.set(requestId, spec);

    return [
      createRequestInput({
        payload: {
          id: requestId,
          question: "Approve this spec? Reply 'Yes' to approve, or describe the changes you want (e.g. 'No, add authentication').",
          expectedSchemaType: "string",
        },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      })
    ];
  }

  private handleInputReceived(event: {
    payload: unknown;
    authorId: string;
  }): BaseEvent[] {
    const payload = event.payload as InputReceivedPayload;
    const id = payload?.id ?? "";
    const answer = payload?.answer;

    const spec = this.pendingByRequestId.get(id);
    if (!spec) return [];

    this.pendingByRequestId.delete(id);

    if (isApproval(answer)) {
      return [
        createPlanApproved({
          payload: { spec },
          authorId: AUTHOR_ID,
          timestamp: Date.now()
        })
      ];
    }

    const feedback = typeof answer === "string" ? answer : String(answer ?? "");

    return [
      createPlanRejected({
        payload: { spec, feedback },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }),
      createEffectSpawnAgent({
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
        timestamp: Date.now()
      })
    ];
  }
}
