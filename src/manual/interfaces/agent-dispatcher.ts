import type { AgentContext } from "./agent-context.js";
import type { AgentRole, AgentType } from './agent-role.js'
import { CancellationToken } from './cancellation-token.js'
import { OutputEventStream } from './output-event-stream.js'

export interface AgentDispatcherProcessOptions {
  context?: AgentContext | undefined
  canceller?: CancellationToken;
}

export interface AgentDispatcher {
  process<TRole extends AgentRole>(
    input: string,
    role: TRole,
    options: AgentDispatcherProcessOptions
  ): OutputEventStream;

  terminate(type: AgentType): void;
}
