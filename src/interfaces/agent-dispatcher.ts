import type { AgentContext } from "./agent-context.js";
import type { AgentRole, AgentType } from './agent-role.js'
import { CancellationToken } from './cancellation-token.js'
import { OutputEventStream } from './output-event-stream.js'
import { BaseEvent } from './event.js'

export interface AgentDispatcherProcessOptions {
  context?: AgentContext | undefined
  canceller?: CancellationToken;
}

/**
 * @deprecated Will be replaced by a modernized AgentDispatcher for lifecycle management.
 */
export interface AgentDispatcher<TEvent extends BaseEvent> {
  process<TRole extends AgentRole>(
    input: string,
    role: TRole,
    options: AgentDispatcherProcessOptions
  ): OutputEventStream<TEvent>;

  terminate(type: AgentType): void;
}
