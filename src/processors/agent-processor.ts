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
import { RingBufferQueue } from "../core/event-queue.js";
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
  private readonly outQueue = new RingBufferQueue<BaseEvent>(1024);

  constructor(
    private readonly config: DuctusConfig,
    private readonly dispatcher: AgentDispatcher,
    private readonly fileAdapter: FileAdapter,
    private readonly cacheAdapter: CacheAdapter,
    private readonly cwd: string
  ) { }

  async *process(stream: InputEventStream): OutputEventStream {
    // Fire-and-forget background consumer of the input stream
    this.consume(stream).catch(console.error);

    // Foreground yielder
    for await (const out of this.outQueue) {
      yield out;
    }
  }

  private async consume(
    stream: InputEventStream
  ): Promise<void> {
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
          const reportPayload: any =
            correlationId !== undefined
              ? { result: cached, correlationId }
              : cached;

          this.outQueue.push(createAgentResponse({
            payload: { text: "Cached", filesModified: reportPayload.files ?? [] },
            authorId: AUTHOR_ID,
            timestamp: Date.now()
          }));
          continue;
        }

        void this.runAgent(eventId, hash, payload, roleName, role);
      }
    }

    this.outQueue.close();
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
          this.outQueue.push(createAgentToken({
            payload: { token: chunk.content },
            authorId: AUTHOR_ID,
            timestamp: Date.now(),
          }));
        } else if (chunk.type === "complete") {
          await this.cacheAdapter.set(hash, chunk.parsedOutput);
          const correlationId = payload?.correlationId;
          const reportPayload: any =
            correlationId !== undefined
              ? { result: chunk.parsedOutput, correlationId }
              : chunk.parsedOutput;

          this.outQueue.push(createAgentResponse({
            payload: { text: "Complete", filesModified: reportPayload.files ?? [] },
            authorId: AUTHOR_ID,
            timestamp: Date.now()
          }));
          break;
        } else if (chunk.type === "failure") {
          this.outQueue.push(createAgentFailure({
            payload: { reason: "format" }, // Or map generic error correctly
            authorId: AUTHOR_ID,
            timestamp: Date.now()
          }));
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
