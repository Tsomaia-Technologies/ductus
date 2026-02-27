/**
 * ToolProcessor - Motor Cortex.
 * Exclusive executor of shell commands. Translates EFFECT_RUN_TOOL to OSAdapter.
 * RFC-001 Task 010-tool-processor, Rev 06 Section 6.3.
 */

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import type { OSAdapter } from "../interfaces/adapters.js";
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

  constructor(
    private readonly osAdapter: OSAdapter,
    private readonly defaultCwd: string
  ) { }

  async *process(stream: InputEventStream): OutputEventStream {
    const iterator = stream[Symbol.asyncIterator]();
    let nextStreamEvent = iterator.next();

    const activeTools = new Map<string, Promise<{ id: string, result: IteratorResult<BaseEvent> }>>();
    const toolIterators = new Map<string, AsyncIterator<BaseEvent>>();

    const addTool = (id: string, iter: AsyncIterableIterator<BaseEvent>) => {
      const asyncIter = iter[Symbol.asyncIterator]();
      toolIterators.set(id, asyncIter);
      activeTools.set(id, asyncIter.next().then(r => ({ id, result: r })).catch(err => {
        return { id, result: { done: true, value: undefined } };
      }));
    };

    let streamDone = false;
    try {
      while (true) {
        if (streamDone && activeTools.size === 0) break;

        const promises: Promise<any>[] = [...activeTools.values()];
        if (!streamDone) {
          promises.push(nextStreamEvent);
        }

        const winner = await Promise.race(promises);

        if (winner && typeof winner === "object" && "id" in winner) {
          const { id, result } = winner;
          if (result.done) {
            activeTools.delete(id);
            toolIterators.delete(id);
          } else {
            yield result.value;
            const iter = toolIterators.get(id);
            if (iter) {
              activeTools.set(id, iter.next().then(r => ({ id, result: r })).catch(err => {
                return { id, result: { done: true, value: undefined } };
              }));
            }
          }
        } else {
          const result = winner as IteratorResult<BaseEvent>;
          if (result.done) {
            streamDone = true;
            continue;
          }
          const event = result.value;
          nextStreamEvent = iterator.next();

          if (event.type === "CIRCUIT_INTERRUPTED") {
            this.abortAll();
            continue;
          }

          if (event.type === "EFFECT_RUN_TOOL") {
            if ((event as any).isReplay) continue;

            const payload = event.payload as EffectRunToolPayload;
            const command = payload?.command ?? "";
            const args = Array.isArray(payload?.args) ? payload.args : [];
            const cwd = payload?.cwd ?? this.defaultCwd;
            const eventId = event.eventId ?? `tool-${Date.now()}-${Math.random()}`;
            const trackingId = payload?.trackingId;

            addTool(eventId, this.runToolGenerator(command, args, cwd, event.timestamp, eventId, trackingId));
          }
        }
      }
    } finally {
      this.abortAll();
    }
  }

  private abortAll(): void {
    for (const [, ctrl] of this.activeExecutions) {
      ctrl.abort();
    }
    this.activeExecutions.clear();
  }

  private async *runToolGenerator(
    command: string,
    args: string[],
    cwd: string,
    timestamp: number,
    eventId: string,
    trackingId?: string
  ): AsyncIterableIterator<BaseEvent> {
    const controller = new AbortController();
    this.activeExecutions.set(eventId, controller);

    try {
      const result = await this.osAdapter.exec(command, args, {
        timeoutMs: TIMEOUT_MS,
        cwd,
        signal: controller.signal,
      });

      const log = result.stdout + result.stderr;

      yield createToolStdoutChunk({
        payload: { chunk: log },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      });

      const basePayload = { trackingId };
      if (result.exitCode === 0) {
        yield createToolCompleted({
          payload: {
            ...basePayload,
            exitCode: 0,
            stdout: result.stdout,
            stderr: result.stderr,
            log,
          },
          authorId: AUTHOR_ID,
          timestamp: Date.now()
        });
      } else {
        yield createToolFailed({
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
        });
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

      yield createToolFailed({
        payload,
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      });
    } finally {
      this.activeExecutions.delete(eventId);
    }
  }
}
