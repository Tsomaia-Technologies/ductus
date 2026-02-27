/**
 * Stub EventProcessors for Bootstrapper DI wiring.
 * Full implementations are built in separate tasks.
 * RFC-001 Task 008, 015.
 */

import { AgentProcessor } from "../processors/agent-processor.js";
import { DevelopmentProcessor } from "../processors/development-processor.js";
import { PlanningProcessor } from "../processors/planning-processor.js";
import { QualityProcessor } from "../processors/quality-processor.js";
import { TelemetryProcessor } from "../processors/telemetry-processor.js";
import { ToolProcessor } from "../processors/tool-processor.js";
import { MockAgentDispatcher } from "../agents/mock-agent-dispatcher.js";
import { MemoryCacheAdapter } from "../adapters/memory-cache-adapter.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { DuctusConfig } from "../core/ductus-config-schema.js";
import type { AgentDispatcher } from "../interfaces/agent-dispatcher.js";
import type { FileAdapter, OSAdapter } from "../interfaces/adapters.js";
import type { CacheAdapter } from "../interfaces/cache-adapter.js";

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
  return {
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
  return new PlanningProcessor();
}

export function createTaskingProcessor(): EventProcessor {
  return createStubProcessor("TaskingProcessor");
}

export function createDevelopmentProcessor(deps?: {
  config: any;
  cwd: string;
}): EventProcessor {
  if (!deps) return createStubProcessor("DevelopmentProcessor");
  return new DevelopmentProcessor(deps.config, deps.cwd);
}

export function createQualityProcessor(deps?: {
  config: any;
  cwd: string;
}): EventProcessor {
  if (!deps) return createStubProcessor("QualityProcessor");
  return new QualityProcessor(deps.config, deps.cwd);
}

export function createAgentProcessor(deps?: {
  config?: any;
  dispatcher?: AgentDispatcher;
  fileAdapter: FileAdapter;
  cacheAdapter?: CacheAdapter;
  cwd: string;
}): EventProcessor {
  if (!deps) {
    return createStubProcessor("AgentProcessor");
  }
  return new AgentProcessor(
    deps.config ?? DEFAULT_AGENT_CONFIG,
    deps.dispatcher ?? new MockAgentDispatcher(),
    deps.fileAdapter,
    deps.cacheAdapter ?? new MemoryCacheAdapter(),
    deps.cwd
  );
}

export function createToolProcessor(deps?: {
  osAdapter: OSAdapter;
  cwd: string;
}): EventProcessor {
  if (!deps) return createStubProcessor("ToolProcessor");
  return new ToolProcessor(deps.osAdapter, deps.cwd);
}

export function createTelemetryProcessor(): EventProcessor {
  return new TelemetryProcessor();
}
