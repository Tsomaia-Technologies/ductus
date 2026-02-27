/**
 * ToolProcessor - Motor Cortex.
 * Exclusive executor of shell commands. Translates EFFECT_RUN_TOOL to OSAdapter.
 * RFC-001 Task 010-tool-processor, Rev 06 Section 6.3.
 */

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import type { OSAdapter } from "../interfaces/adapters.js";
import { RingBufferQueue } from "../core/event-queue.js";
import { createToolStdoutChunk, createToolCompleted, createToolFailed } from "../core/events/creators.js";

interface EffectRunToolPayload {
  command: string;
  args: string[];
  cwd?: string;
  /** Correlation ID echoed in TOOL_COMPLETED/TOOL_FAILED for DevelopmentProcessor tracking. */
  trackingId?: string;
}

type EnqueuedEvent = {
  type: string;
  payload: unknown;
  authorId: string;
  timestamp: number;
  eventId?: string;
  isReplay?: boolean;
};

const TIMEOUT_MS = 60000;
const AUTHOR_ID = "tool-processor";

export class ToolProcessor implements EventProcessor {
  private readonly activeExecutions = new Map<string, AbortController>();
  private readonly outQueue = new RingBufferQueue<BaseEvent>(128);

  constructor(
    private readonly osAdapter: OSAdapter,
    private readonly defaultCwd: string
  ) { }

  async *process(stream: InputEventStream): OutputEventStream {
    this.consumeAndExecute(stream).catch(console.error);
    for await (const out of this.outQueue) {
      yield out;
    }
  }

  private async consumeAndExecute(
    stream: AsyncIterable<EnqueuedEvent>
  ): Promise<void> {
    for await (const event of stream) {
      if (event.type === "CIRCUIT_INTERRUPTED") {
        this.abortAll();
        continue;
      }

      if (event.type === "EFFECT_RUN_TOOL") {
        if (event.isReplay) continue;

        const payload = event.payload as EffectRunToolPayload;
        const command = payload?.command ?? "";
        const args = Array.isArray(payload?.args) ? payload.args : [];
        const cwd = payload?.cwd ?? this.defaultCwd;
        const eventId = event.eventId ?? `tool-${Date.now()}-${Math.random()}`;
        const trackingId = payload?.trackingId;

        // Do NOT await, so we don't block CIRCUIT_INTERRUPTED.
        this.runTool(command, args, cwd, event.timestamp, eventId, trackingId).catch(console.error);
      }
    }
    this.outQueue.close();
  }

  private abortAll(): void {
    for (const [, ctrl] of this.activeExecutions) {
      ctrl.abort();
    }
    this.activeExecutions.clear();
  }

  private async runTool(
    command: string,
    args: string[],
    cwd: string,
    timestamp: number,
    eventId: string,
    trackingId?: string
  ): Promise<void> {
    const controller = new AbortController();
    this.activeExecutions.set(eventId, controller);

    try {
      const result = await this.osAdapter.exec(command, args, {
        timeoutMs: TIMEOUT_MS,
        cwd,
        signal: controller.signal,
      });

      const log = result.stdout + result.stderr;

      this.outQueue.push(createToolStdoutChunk({
        payload: { chunk: log },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }));

      const basePayload = { trackingId };
      if (result.exitCode === 0) {
        this.outQueue.push(createToolCompleted({
          payload: {
            ...basePayload,
            exitCode: 0,
            stdout: result.stdout,
            stderr: result.stderr,
            log,
          },
          authorId: AUTHOR_ID,
          timestamp: Date.now()
        }));
      } else {
        this.outQueue.push(createToolFailed({
          payload: {
            ...basePayload,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            log,
            reason: "NONZERO_EXIT",
          },
          authorId: AUTHOR_ID,
          timestamp: Date.now()
        }));
      }
    } catch (err) {
      if ((err as Error & { name?: string }).name === "AbortError") {
        return;
      }
      const reason =
        String(err).toLowerCase().includes("timeout") ||
          String(err).toLowerCase().includes("timed out")
          ? "TIMEOUT"
          : "ERROR";
      const msg = err instanceof Error ? err.message : String(err);

      const payload: Record<string, unknown> = {
        exitCode: -1,
        stdout: "",
        stderr: msg,
        log: msg,
        reason,
      };
      if (trackingId !== undefined) payload.trackingId = trackingId;

      this.outQueue.push(createToolFailed({
        payload,
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }));
    } finally {
      this.activeExecutions.delete(eventId);
    }
  }
}
