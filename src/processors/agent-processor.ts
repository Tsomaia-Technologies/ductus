/**
 * AgentProcessor - The Gateway.
 * ONLY processor allowed to initiate LLM requests. Bridge between Circuit and AgentDispatcher.
 * RFC-001 Task 015-agent-processor, Rev 06 Section 2.1.
 */

import { join } from "node:path";
import { render } from "@tsomaiatech/moxite";
import type { BaseEvent } from "../core/event-contracts.js";
import type { DuctusConfig } from "../core/ductus-config-schema.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { EventQueue } from "../interfaces/event-queue.js";
import type { FileAdapter } from "../interfaces/adapters.js";
import type { CacheAdapter } from "../interfaces/cache-adapter.js";
import type { AgentDispatcher } from "../interfaces/agent-dispatcher.js";
import type { AgentRole } from "../interfaces/agent-role.js";
import type { AgentContext } from "../interfaces/agent-context.js";
import { EngineerAgent } from "../agents/engineer-agent.js";
import { PlannerAgent } from "../agents/planner-agent.js";
import { AuditorAgent } from "../agents/auditor-agent.js";

const AUTHOR_ID = "agent-processor";

interface AgentHub {
  broadcast(base: BaseEvent): Promise<void>;
}

interface EffectSpawnAgentPayload {
  roleName: string;
  scope: string;
  input: string;
  context?: AgentContext;
  /** Correlation ID echoed in AGENT_REPORT_RECEIVED for QualityProcessor etc. */
  correlationId?: string;
}

type EnqueuedEvent = {
  type: string;
  payload: unknown;
  authorId: string;
  timestamp: number;
  eventId?: string;
  hash?: string;
  isReplay?: boolean;
};

const ROLE_MAP: Record<string, AgentRole<unknown>> = {
  engineer: new EngineerAgent(),
  planner: new PlannerAgent(),
  auditor: new AuditorAgent(),
};

export class AgentProcessor implements EventProcessor {
  private readonly activeAborts = new Map<string, AbortController>();

  constructor(
    private readonly hub: AgentHub,
    private readonly config: DuctusConfig,
    private readonly dispatcher: AgentDispatcher,
    private readonly fileAdapter: FileAdapter,
    private readonly cacheAdapter: CacheAdapter,
    private readonly cwd: string,
    public readonly incomingQueue: EventQueue
  ) {}

  process(stream: InputEventStream): OutputEventStream {
    return this.consumeAndDispatch(stream);
  }

  private async *consumeAndDispatch(
    stream: AsyncIterable<EnqueuedEvent>
  ): OutputEventStream {
    for await (const event of stream) {
      if (event.type === "CIRCUIT_INTERRUPTED") {
        this.abortAll();
        continue;
      }

      if (event.type === "EFFECT_SPAWN_AGENT") {
        if (event.isReplay) continue;

        const payload = event.payload as EffectSpawnAgentPayload;
        const roleName = payload?.roleName ?? "";
        const role = ROLE_MAP[roleName];
        if (!role) continue;

        const hash = event.hash ?? "";
        const eventId = event.eventId ?? `agent-${Date.now()}`;

        const cached = await this.cacheAdapter.get<unknown>(hash);
        if (cached !== undefined) {
          const correlationId = payload?.correlationId;
          const reportPayload =
            correlationId !== undefined
              ? { result: cached, correlationId }
              : cached;
          void this.hub.broadcast({
            type: "AGENT_REPORT_RECEIVED",
            payload: reportPayload,
            authorId: AUTHOR_ID,
            timestamp: Date.now(),
            volatility: "durable-draft",
          });
          continue;
        }

        void this.runAgent(eventId, hash, payload, roleName, role);
      }
    }
  }

  private async runAgent(
    eventId: string,
    hash: string,
    payload: EffectSpawnAgentPayload,
    roleName: string,
    role: AgentRole<unknown>
  ): Promise<void> {
    const ac = new AbortController();
    this.activeAborts.set(eventId, ac);

    try {
      const scopeConfig = this.resolveScope(payload?.scope);
      const strategy = scopeConfig?.roles[roleName]?.strategies?.[0];
      const templatePath = strategy?.template
        ? join(this.cwd, strategy.template)
        : null;

      let systemPrompt = role.systemPrompt;
      if (templatePath) {
        const raw = await this.fileAdapter.read(templatePath);
        systemPrompt = render(raw, { context: payload?.context ?? {} });
      }

      const roleWithPrompt = { ...role, systemPrompt };
      const dispatcherStream = this.dispatcher.process(
        payload?.input ?? "",
        roleWithPrompt,
        payload?.context,
        { signal: ac.signal, maxTokens: 4096, maxRetries: 2 }
      );

      for await (const chunk of dispatcherStream) {
        if (chunk.type === "token") {
          void this.hub.broadcast({
            type: "AGENT_TOKEN_STREAM",
            payload: { chunk: chunk.content },
            authorId: AUTHOR_ID,
            timestamp: Date.now(),
            volatility: "volatile-draft",
          });
        } else if (chunk.type === "complete") {
          await this.cacheAdapter.set(hash, chunk.parsedOutput);
          const correlationId = payload?.correlationId;
          const reportPayload =
            correlationId !== undefined
              ? { result: chunk.parsedOutput, correlationId }
              : chunk.parsedOutput;
          void this.hub.broadcast({
            type: "AGENT_REPORT_RECEIVED",
            payload: reportPayload,
            authorId: AUTHOR_ID,
            timestamp: Date.now(),
            volatility: "durable-draft",
          });
          break;
        } else if (chunk.type === "failure") {
          void this.hub.broadcast({
            type: "AGENT_FAILURE",
            payload: { error: chunk.error },
            authorId: AUTHOR_ID,
            timestamp: Date.now(),
            volatility: "durable-draft",
          });
          break;
        }
      }
    } catch (err) {
      if ((err as Error & { name?: string }).name === "AbortError") {
        return;
      }
      throw err;
    } finally {
      this.activeAborts.delete(eventId);
    }
  }

  private resolveScope(scopeName?: string): DuctusConfig["default"] | undefined {
    if (!scopeName || scopeName === "default") {
      return this.config.default;
    }
    const scope = this.config.scopes?.[scopeName];
    return scope ?? this.config.default;
  }

  private abortAll(): void {
    for (const [, ctrl] of this.activeAborts) {
      ctrl.abort();
    }
    this.activeAborts.clear();
  }
}
