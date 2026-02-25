import { AgentRole } from './agent-role.js'
import { OutputEventStream } from './output-event-stream.js'

export interface AgentDispatcher {
  process<TContext extends object>(
    input: string,
    role: AgentRole<TContext>,
  ): Promise<OutputEventStream>

  terminate(role: AgentRole<object>): void
}
