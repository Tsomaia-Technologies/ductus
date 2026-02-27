import { AgentContext } from './agent-context.js'
import { AgentRole } from './agent-role.js'
import { OutputEventStream } from './output-event-stream.js'

export interface AgentDispatcher {
  process<TContext extends object>(
    input: string,
    role: AgentRole<TContext, any>,
    context?: AgentContext
  ): Promise<OutputEventStream>

  terminate(role: AgentRole<any, any>): void
}
