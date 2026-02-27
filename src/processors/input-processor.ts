/**
 * InputProcessor - Sensory Cortex.
 * Handles REQUEST_INPUT: queries human via TerminalAdapter, yields INPUT_RECEIVED.
 * Zero raw prompts; all interaction through TerminalAdapter. Hydration bypass for replay.
 * RFC-001 Task 011-input-processor, Rev 06 Section 6.1.
 */

import { z } from "zod";
import type { BaseEvent } from "../core/event-contracts.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { TerminalAdapter } from "../interfaces/adapters.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { EventQueue } from "../interfaces/event-queue.js";

interface InputProcessorHub {
  broadcast(base: BaseEvent): Promise<void>;
}

interface RequestInputPayload {
  id: string;
  question: string;
  expectedSchemaType: string;
}

type EnqueuedEvent = {
  type: string;
  payload: unknown;
  authorId: string;
  timestamp: number;
  eventId?: string;
  isReplay?: boolean;
};

const AUTHOR_ID = "input-processor";

/** Maps schema type identifiers to adapter invocation. */
function resolveSchemaAndAdapter(
  expectedSchemaType: string,
  question: string,
  adapter: TerminalAdapter
): Promise<unknown> {
  switch (expectedSchemaType) {
    case "string":
      return adapter.ask(question, z.string());
    case "boolean":
      return adapter.confirm(question);
    default:
      throw new Error(
        `InputProcessor: unknown expectedSchemaType "${expectedSchemaType}"`
      );
  }
}

export class InputProcessor implements EventProcessor {
  constructor(
    private readonly hub: InputProcessorHub,
    private readonly terminalAdapter: TerminalAdapter,
    public readonly incomingQueue: EventQueue
  ) {}

  process(stream: InputEventStream): OutputEventStream {
    return this.consumeAndPrompt(stream);
  }

  private async *consumeAndPrompt(
    stream: AsyncIterable<EnqueuedEvent>
  ): OutputEventStream {
    for await (const event of stream) {
      if (event.type === "REQUEST_INPUT") {
        if (event.isReplay) continue;

        const payload = event.payload as RequestInputPayload;
        const id = payload?.id ?? "";
        const question = payload?.question ?? "";
        const expectedSchemaType = payload?.expectedSchemaType ?? "string";

        const answer = await resolveSchemaAndAdapter(
          expectedSchemaType,
          question,
          this.terminalAdapter
        );

        void this.hub.broadcast({
          type: "INPUT_RECEIVED",
          payload: { id, answer },
          authorId: AUTHOR_ID,
          timestamp: Date.now(),
          volatility: "durable-draft",
        });
      }
    }
  }
}
