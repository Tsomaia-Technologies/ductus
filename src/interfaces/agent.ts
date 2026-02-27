import { AgentContext } from './agent-context.js'
import { OutputEventStream } from './output-event-stream.js'

export interface AgentExecutionOptions {
  abort?: AbortSignal
}

export interface Agent {
  initialize(context: AgentContext): Promise<void>

  process(input: string, options: AgentExecutionOptions): OutputEventStream

  terminate(): Promise<void>
}
