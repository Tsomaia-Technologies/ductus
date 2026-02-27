/**
 * TelemetryProcessor - The Accountant / Metabolism.
 * Strictly observational: compiles aggregate metrics from event stream.
 * Zero power over State Machine. Yields only volatile events.
 * RFC-001 Task 019-telemetry-processor, Rev 06 Section 2.1, 5.1.
 */

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import { RingBufferQueue } from "../core/event-queue.js";
import { createTelemetryUpdated } from "../core/events/creators.js";

const AUTHOR_ID = "telemetry-processor";

interface UsagePayload {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

interface ModelMetrics {
  inputTokens: number;
  outputTokens: number;
}

export interface TelemetryAccumulate {
  byModel: Record<string, ModelMetrics>;
  totalInputTokens: number;
  totalOutputTokens: number;
  sessionStartTimestamp: number | null;
}

type EnqueuedEvent = {
  type: string;
  payload: unknown;
  timestamp: number;
  isReplay?: boolean;
};

export class TelemetryProcessor implements EventProcessor {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private readonly byModel = new Map<string, ModelMetrics>();
  private sessionStartTimestamp: number | null = null;
  private readonly outQueue = new RingBufferQueue<BaseEvent>(128);

  constructor() { }

  /** Debug accessor for Definition of Done tests. Returns current accumulated state. */
  getAccumulatedMetrics(): TelemetryAccumulate {
    const byModel: Record<string, ModelMetrics> = {};
    for (const [k, v] of this.byModel) {
      byModel[k] = { ...v };
    }
    return {
      byModel,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      sessionStartTimestamp: this.sessionStartTimestamp,
    };
  }

  async *process(stream: InputEventStream): OutputEventStream {
    this.consumeAndAggregate(stream).catch(console.error);
    for await (const out of this.outQueue) {
      yield out;
    }
  }

  private async consumeAndAggregate(
    stream: AsyncIterable<EnqueuedEvent>
  ): Promise<void> {
    for await (const event of stream) {
      if (event.type === "SYSTEM_START") {
        this.resetAccumulators();
        this.sessionStartTimestamp = event.timestamp;
        continue;
      }

      if (event.type === "CIRCUIT_INTERRUPTED" || event.type === "SYSTEM_HALT") {
        this.emitTelemetryUpdated();
        this.resetAccumulators();
        continue;
      }

      if (event.type === "AGENT_RESPONSE") {
        this.accumulateUsage(event.payload);
        this.emitTelemetryUpdated();
      }
    }
    this.outQueue.close();
  }

  private accumulateUsage(payload: unknown): void {
    if (payload === null || typeof payload !== "object") return;
    const raw = (payload as Record<string, unknown>).usage;
    if (raw === null || typeof raw !== "object") return;

    const u = raw as UsagePayload;
    const input = typeof u.inputTokens === "number" ? u.inputTokens : 0;
    const output = typeof u.outputTokens === "number" ? u.outputTokens : 0;
    if (input === 0 && output === 0) return;

    const model = typeof u.model === "string" && u.model.length > 0 ? u.model : "unknown";
    const existing = this.byModel.get(model);
    if (existing) {
      existing.inputTokens += input;
      existing.outputTokens += output;
    } else {
      this.byModel.set(model, { inputTokens: input, outputTokens: output });
    }
    this.totalInputTokens += input;
    this.totalOutputTokens += output;
  }

  private emitTelemetryUpdated(): void {
    const byModel: Record<string, ModelMetrics> = {};
    for (const [k, v] of this.byModel) {
      byModel[k] = { ...v };
    }
    this.outQueue.push(createTelemetryUpdated({
      payload: {
        byModel,
        totalInputTokens: this.totalInputTokens,
        totalOutputTokens: this.totalOutputTokens,
        sessionStartTimestamp: this.sessionStartTimestamp,
      },
      authorId: AUTHOR_ID,
      timestamp: Date.now()
    }));
  }

  private resetAccumulators(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.byModel.clear();
    this.sessionStartTimestamp = null;
  }
}
