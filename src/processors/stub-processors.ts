/**
 * Stub EventProcessors for Bootstrapper DI wiring.
 * Full implementations are built in separate tasks.
 * RFC-001 Task 008, 015.
 */

import { AsyncEventQueue } from "../core/event-queue.js";
import { AgentProcessor } from "../processors/agent-processor.js";
import { DevelopmentProcessor } from "../processors/development-processor.js";
import { PlanningProcessor } from "../processors/planning-processor.js";
import { QualityProcessor } from "../processors/quality-processor.js";
import { ToolProcessor } from "../processors/tool-processor.js";
import { MockAgentDispatcher } from "../agents/mock-agent-dispatcher.js";
import { MemoryCacheAdapter } from "../adapters/memory-cache-adapter.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { DuctusConfig } from "../core/ductus-config-schema.js";
import type { MultiplexerHub } from "../core/multiplexer-hub.js";
import type { AgentDispatcher } from "../interfaces/agent-dispatcher.js";
import type { FileAdapter, OSAdapter } from "../interfaces/adapters.js";
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
      auditor: {
        lifecycle: "single-shot",
        maxRejections: 0,
        maxRecognizedHallucinations: 0,
        strategies: [{ id: "default", model: "claude", template: "auditor" }],
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

export function createPlanningProcessor(deps?: { hub: MultiplexerHub }): EventProcessor {
  if (!deps) return createStubProcessor("PlanningProcessor");
  const queue = new AsyncEventQueue();
  return new PlanningProcessor(deps.hub, queue);
}

export function createTaskingProcessor(): EventProcessor {
  return createStubProcessor("TaskingProcessor");
}

export function createDevelopmentProcessor(deps?: {
  hub: MultiplexerHub;
  config: DuctusConfig;
  cwd: string;
}): EventProcessor {
  if (!deps) return createStubProcessor("DevelopmentProcessor");
  const queue = new AsyncEventQueue();
  return new DevelopmentProcessor(deps.hub, deps.config, deps.cwd, queue);
}

export function createQualityProcessor(deps?: {
  hub: MultiplexerHub;
  config: DuctusConfig;
  cwd: string;
}): EventProcessor {
  if (!deps) return createStubProcessor("QualityProcessor");
  const queue = new AsyncEventQueue();
  return new QualityProcessor(deps.hub, deps.config, deps.cwd, queue);
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

export function createToolProcessor(deps?: {
  hub: MultiplexerHub;
  osAdapter: OSAdapter;
  cwd: string;
}): EventProcessor {
  if (!deps) return createStubProcessor("ToolProcessor");
  const queue = new AsyncEventQueue();
  return new ToolProcessor(deps.hub, deps.osAdapter, deps.cwd, queue);
}

export function createTelemetryProcessor(): EventProcessor {
  return createStubProcessor("TelemetryProcessor");
}
