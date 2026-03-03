import { AgentContext } from './agent-context.js'
import { OutputEventStream } from './output-event-stream.js'
import { CancellationToken } from './cancellation-token.js'
import { BaseEvent } from './event.js'

export interface AgentExecutionOptions {
  abort?: CancellationToken
}

/**
 * @deprecated Superseded by AgentBuilder + AgentEntity + AgentAdapter pattern.
 */
export interface Agent<TEvent extends BaseEvent> {
  initialize(context: AgentContext): Promise<void>

  process(input: string, options: AgentExecutionOptions): OutputEventStream<TEvent>

  terminate(): Promise<void>
}
