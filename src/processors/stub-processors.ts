/**
 * Stub EventProcessors for Bootstrapper DI wiring.
 * Full implementations are built in separate tasks.
 * RFC-001 Task 008, 015.
 */

import { AsyncEventQueue } from "../core/event-queue.js";
import { AgentProcessor } from "../processors/agent-processor.js";
import { MockAgentDispatcher } from "../agents/mock-agent-dispatcher.js";
import { MemoryCacheAdapter } from "../adapters/memory-cache-adapter.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { DuctusConfig } from "../core/ductus-config-schema.js";
import type { MultiplexerHub } from "../core/multiplexer-hub.js";
import type { AgentDispatcher } from "../interfaces/agent-dispatcher.js";
import type { FileAdapter } from "../interfaces/adapters.js";
import type { CacheAdapter } from "../interfaces/cache-adapter.js";
import type { EventQueue } from "../interfaces/event-queue.js";

const DEFAULT_AGENT_CONFIG: DuctusConfig = {
  default: {
    checks: {},
    roles: {
      planner: {
        lifecycle: "single-shot",
        maxRejections: 3,
        maxRecognizedHallucinations: 0,
        strategies: [{ id: "default", model: "claude", template: "planner" }],
      },
      engineer: {
        lifecycle: "session",
        maxRejections: 5,
        maxRecognizedHallucinations: 2,
        strategies: [{ id: "default", model: "claude", template: "engineer" }],
      },
    },
  },
  scopes: {},
};

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

export function createAgentProcessor(deps?: {
  hub: MultiplexerHub;
  config?: DuctusConfig;
  dispatcher?: AgentDispatcher;
  fileAdapter: FileAdapter;
  cacheAdapter?: CacheAdapter;
  cwd: string;
}): EventProcessor {
  if (!deps) {
    return createStubProcessor("AgentProcessor");
  }
  const queue = new AsyncEventQueue();
  return new AgentProcessor(
    deps.hub,
    deps.config ?? DEFAULT_AGENT_CONFIG,
    deps.dispatcher ?? new MockAgentDispatcher(),
    deps.fileAdapter,
    deps.cacheAdapter ?? new MemoryCacheAdapter(),
    deps.cwd,
    queue
  );
}

export function createToolProcessor(): EventProcessor {
  return createStubProcessor("ToolProcessor");
}

export function createTelemetryProcessor(): EventProcessor {
  return createStubProcessor("TelemetryProcessor");
}
