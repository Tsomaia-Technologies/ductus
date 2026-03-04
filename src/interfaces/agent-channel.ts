import { AgentContext } from './agent-context.js'
import { CancellationToken } from './cancellation-token.js'
import { AgentChunk } from './agent-chunk.js'

export interface AgentChannelProcessOptions {
  context?: AgentContext
  canceller?: CancellationToken
}

/**
 * @deprecated Superseded by AdapterEntity + AgentAdapter pattern.
 * Will be removed in a future version.
 */
export interface AgentChannel<TInput> {
  initialize(): Promise<void>

  process(
    input: TInput,
    options?: AgentChannelProcessOptions,
  ): AsyncIterable<AgentChunk>

  terminate(): Promise<void>
}
