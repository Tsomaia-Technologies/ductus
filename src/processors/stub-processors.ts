/**
 * Stub EventProcessors for Bootstrapper DI wiring.
 * Full implementations are built in separate tasks.
 * RFC-001 Task 008.
 */

import { AsyncEventQueue } from "../core/event-queue.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";

function createStubProcessor(name: string): EventProcessor {
  const queue = new AsyncEventQueue();
  return {
    incomingQueue: queue,
    process: (stream: InputEventStream): OutputEventStream =>
      (async function* () {
        for await (const _ of stream) {
          /* no-op */
        }
      })(),
  };
}

export function createSessionProcessor(): EventProcessor {
  return createStubProcessor("SessionProcessor");
}

export function createPlanningProcessor(): EventProcessor {
  return createStubProcessor("PlanningProcessor");
}

export function createTaskingProcessor(): EventProcessor {
  return createStubProcessor("TaskingProcessor");
}

export function createDevelopmentProcessor(): EventProcessor {
  return createStubProcessor("DevelopmentProcessor");
}

export function createQualityProcessor(): EventProcessor {
  return createStubProcessor("QualityProcessor");
}

export function createAgentProcessor(): EventProcessor {
  return createStubProcessor("AgentProcessor");
}

export function createToolProcessor(): EventProcessor {
  return createStubProcessor("ToolProcessor");
}

export function createTelemetryProcessor(): EventProcessor {
  return createStubProcessor("TelemetryProcessor");
}
