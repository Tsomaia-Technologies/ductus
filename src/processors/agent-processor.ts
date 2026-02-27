/**
 * AgentProcessor - The Gateway.
 * ONLY processor allowed to initiate LLM requests. Bridge between Circuit and AgentDispatcher.
 * RFC-001 Task 015-agent-processor, Rev 06 Section 2.1.
 */

import { join } from "node:path";
import { render } from "@tsomaiatech/moxite";
import type { BaseEvent } from "../interfaces/event.js";
import type { DuctusConfig } from "../core/ductus-config-schema.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import { createAgentResponse, createAgentToken, createAgentFailure } from "../core/events/creators.js";

import type { FileAdapter } from "../interfaces/adapters.js";
import type { CacheAdapter } from "../interfaces/cache-adapter.js";
import type { AgentDispatcher } from "../interfaces/agent-dispatcher.js";
import type { AgentRole } from "../interfaces/agent-role.js";
import type { AgentContext } from "../interfaces/agent-context.js";
import { EngineerAgent } from "../agents/engineer-agent.js";
import { PlannerAgent } from "../agents/planner-agent.js";
import { AuditorAgent } from "../agents/auditor-agent.js";

const AUTHOR_ID = "agent-processor";

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
    private readonly config: DuctusConfig,
    private readonly dispatcher: AgentDispatcher,
    private readonly fileAdapter: FileAdapter,
    private readonly cacheAdapter: CacheAdapter,
    private readonly cwd: string
  ) { }

  async *process(stream: InputEventStream): OutputEventStream {
    const iterator = stream[Symbol.asyncIterator]();
    let nextStreamEvent = iterator.next();

    const activeAgents = new Map<string, Promise<{ id: string, result: IteratorResult<BaseEvent> }>>();
    const agentIterators = new Map<string, AsyncIterator<BaseEvent>>();

    const addAgent = (id: string, iter: AsyncIterableIterator<BaseEvent>) => {
      const asyncIter = iter[Symbol.asyncIterator]();
      agentIterators.set(id, asyncIter);
      activeAgents.set(id, asyncIter.next().then(r => ({ id, result: r })).catch(err => {
        return { id, result: { done: true, value: undefined } };
      }));
    };

    let streamDone = false;
    try {
      while (true) {
        if (streamDone && activeAgents.size === 0) break;

        const promises: Promise<any>[] = [...activeAgents.values()];
        if (!streamDone) {
          promises.push(nextStreamEvent);
        }

        const winner = await Promise.race(promises);

        if (winner && typeof winner === "object" && "id" in winner) {
          const { id, result } = winner;
          if (result.done) {
            activeAgents.delete(id);
            agentIterators.delete(id);
          } else {
            yield result.value;
            const iter = agentIterators.get(id);
            if (iter) {
              activeAgents.set(id, iter.next().then(r => ({ id, result: r })).catch(err => {
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

          if (event.type === "EFFECT_SPAWN_AGENT") {
            if ((event as any).isReplay === true) continue;
            const payload = event.payload as EffectSpawnAgentPayload;
            const roleName = payload?.roleName ?? "";
            const role = ROLE_MAP[roleName];
            if (role) {
              const id = event.eventId ?? `agent-${Date.now()}`;
              addAgent(id, this.runAgentGenerator(id, (event as any).hash ?? "", payload, roleName, role));
            }
          }
        }
      }
    } finally {
      this.abortAll();
    }
  }

  private async *runAgentGenerator(
    eventId: string,
    hash: string,
    payload: EffectSpawnAgentPayload,
    roleName: string,
    role: AgentRole<unknown>
  ): AsyncIterableIterator<BaseEvent> {
    const cached = await this.cacheAdapter.get<unknown>(hash);
    if (cached !== undefined) {
      const correlationId = payload?.correlationId;
      const reportPayload: any =
        correlationId !== undefined
          ? { result: cached, correlationId }
          : cached;

      yield createAgentResponse({
        payload: { text: "Cached", filesModified: reportPayload.files ?? [] },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      });
      return;
    }

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
          yield createAgentToken({
            payload: { token: chunk.content },
            authorId: AUTHOR_ID,
            timestamp: Date.now(),
          });
        } else if (chunk.type === "complete") {
          await this.cacheAdapter.set(hash, chunk.parsedOutput);
          const correlationId = payload?.correlationId;
          const reportPayload: any =
            correlationId !== undefined
              ? { result: chunk.parsedOutput, correlationId }
              : chunk.parsedOutput;

          yield createAgentResponse({
            payload: { text: "Complete", filesModified: reportPayload.files ?? [] },
            authorId: AUTHOR_ID,
            timestamp: Date.now()
          });
          break;
        } else if (chunk.type === "failure") {
          yield createAgentFailure({
            payload: { reason: "format" },
            authorId: AUTHOR_ID,
            timestamp: Date.now()
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
