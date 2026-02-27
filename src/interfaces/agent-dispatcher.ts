import type { AgentContext } from "./agent-context.js";
import type { AgentRole } from "./agent-role.js";
import type { AgentStreamEvent } from "./agent-stream-event.js";

export interface AgentDispatcherProcessOptions {
  signal?: AbortSignal;
  maxTokens: number;
  maxRetries?: number;
}

export interface AgentDispatcher {
  process<TOutput>(
    input: string,
    role: AgentRole<TOutput>,
    context: AgentContext | undefined,
    options: AgentDispatcherProcessOptions
  ): AsyncIterableIterator<AgentStreamEvent<TOutput>>;

  terminate(role: AgentRole<unknown>): void;
}
