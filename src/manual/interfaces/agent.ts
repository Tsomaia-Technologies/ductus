import { AgentContext } from './agent-context.js'
import { OutputEventStream } from './output-event-stream.js'
import { CancellationToken } from './cancellation-token.js'

export interface AgentExecutionOptions {
  abort?: CancellationToken
}

export interface Agent {
  initialize(context: AgentContext): Promise<void>

  process(input: string, options: AgentExecutionOptions): OutputEventStream

  terminate(): Promise<void>
}
