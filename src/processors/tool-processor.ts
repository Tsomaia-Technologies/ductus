/**
 * ToolProcessor - Motor Cortex.
 * Exclusive executor of shell commands. Translates EFFECT_RUN_TOOL to OSAdapter.
 * RFC-001 Task 010-tool-processor, Rev 06 Section 6.3.
 */

import type { BaseEvent } from "../core/event-contracts.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { OSAdapter } from "../interfaces/adapters.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { EventQueue } from "../interfaces/event-queue.js";

interface ToolHub {
  broadcast(base: BaseEvent): Promise<void>;
}

interface EffectRunToolPayload {
  command: string;
  args: string[];
  cwd?: string;
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
    private readonly hub: ToolHub,
    private readonly osAdapter: OSAdapter,
    private readonly defaultCwd: string,
    public readonly incomingQueue: EventQueue
  ) {}

  process(stream: InputEventStream): OutputEventStream {
    return this.consumeAndExecute(stream);
  }

  private async *consumeAndExecute(
    stream: AsyncIterable<EnqueuedEvent>
  ): OutputEventStream {
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

        await this.runTool(command, args, cwd, event.timestamp, eventId);
      }
    }
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
    eventId: string
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

      void this.hub.broadcast({
        type: "TOOL_STDOUT_CHUNK",
        payload: { chunk: log },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "volatile-draft",
      });

      if (result.exitCode === 0) {
        void this.hub.broadcast({
          type: "TOOL_COMPLETED",
          payload: { exitCode: 0, stdout: result.stdout, stderr: result.stderr, log },
          authorId: AUTHOR_ID,
          timestamp: Date.now(),
          volatility: "durable-draft",
        });
      } else {
        void this.hub.broadcast({
          type: "TOOL_FAILED",
          payload: {
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            log,
            reason: "NONZERO_EXIT",
          },
          authorId: AUTHOR_ID,
          timestamp: Date.now(),
          volatility: "durable-draft",
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

      void this.hub.broadcast({
        type: "TOOL_FAILED",
        payload: {
          exitCode: -1,
          stdout: "",
          stderr: msg,
          log: msg,
          reason,
        },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "durable-draft",
      });
    } finally {
      this.activeExecutions.delete(eventId);
    }
  }
}
