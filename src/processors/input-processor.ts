/**
 * InputProcessor - Sensory Cortex.
 * Handles REQUEST_INPUT: queries human via TerminalAdapter, yields INPUT_RECEIVED.
 * Zero raw prompts; all interaction through TerminalAdapter. Hydration bypass for replay.
 * RFC-001 Task 011-input-processor, Rev 06 Section 6.1.
 */

import { z } from "zod";
import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import type { TerminalAdapter } from "../interfaces/adapters.js";
import { RingBufferQueue } from "../core/event-queue.js";
import { createInputReceived } from "../core/events/creators.js";

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
  private readonly outQueue = new RingBufferQueue<BaseEvent>(128);

  constructor(
    private readonly terminalAdapter: TerminalAdapter
  ) { }

  async *process(stream: InputEventStream): OutputEventStream {
    this.consumeAndPrompt(stream).catch(console.error);
    for await (const out of this.outQueue) {
      yield out;
    }
  }

  private async consumeAndPrompt(
    stream: InputEventStream
  ): Promise<void> {
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
        ) as string;

        this.outQueue.push(createInputReceived({
          payload: { id, answer },
          authorId: AUTHOR_ID,
          timestamp: Date.now()
        }));
      }
    }

    this.outQueue.close();
  }
}
