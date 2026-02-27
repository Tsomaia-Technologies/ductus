/**
 * LoggerProcessor - Broca's Area.
 * Event Sink: listens to Hub, formats events for terminal output via TerminalAdapter.
 * Inverse of PersistenceProcessor: cares about volatile UI noise (tokens, progress).
 * RFC-001 Task 005-logger-processor, Impl Guide Phase 3.
 */

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import type { TerminalAdapter } from "../interfaces/adapters.js";
import { RingBufferQueue } from "../core/event-queue.js";

type EnqueuedEvent = BaseEvent;

const RED = "\u001b[31m";
const RESET = "\u001b[0m";

export class LoggerProcessor implements EventProcessor {
  private readonly outQueue = new RingBufferQueue<BaseEvent>(16);

  constructor(
    private readonly terminalAdapter: TerminalAdapter
  ) { }

  async *process(stream: InputEventStream): OutputEventStream {
    this.consumeAndFormat(stream).catch(console.error);
    for await (const out of this.outQueue) {
      yield out;
    }
  }

  private async consumeAndFormat(
    stream: AsyncIterable<EnqueuedEvent>
  ): Promise<void> {
    for await (const event of stream) {
      if (event.isReplay) continue;

      const formatted = this.formatEvent(event);
      if (formatted !== null) {
        this.terminalAdapter.log(formatted);
      }
    }

    this.outQueue.close();
  }

  private formatEvent(event: EnqueuedEvent): string | null {
    switch (event.type) {
      case "AGENT_TOKEN_STREAM":
        return this.formatAgentTokenStream(event.payload);
      case "CIRCUIT_INTERRUPTED":
      case "EMERGENCY_STOP":
        return this.formatPanic(event.type, event.payload);
      default:
        return null;
    }
  }

  private formatAgentTokenStream(payload: unknown): string | null {
    if (payload !== null && typeof payload === "object" && "chunk" in payload) {
      const chunk = (payload as { chunk: string }).chunk;
      return typeof chunk === "string" ? chunk : null;
    }
    if (payload !== null && typeof payload === "object" && "token" in payload) {
      const token = (payload as { token: string }).token;
      return typeof token === "string" ? token : null;
    }
    return null;
  }

  private formatPanic(type: string, payload: unknown): string {
    const msg =
      payload !== null && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : type;
    return `${RED}[ABORT] ${msg}${RESET}`;
  }
}
