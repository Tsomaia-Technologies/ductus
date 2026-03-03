import { ModelEntity } from './model-entity.js'
import { AgentContext } from '../agent-context.js'
import { CancellationToken } from '../cancellation-token.js'
import { AgentEntity } from './agent-entity.js'

export interface TransportProcessOptions {
  canceller?: CancellationToken
}

export interface TransportEntity {
  initialize(
    agent: AgentEntity,
    model: ModelEntity,
    context?: AgentContext,
  ): Promise<void>
  process(input: string, options: TransportProcessOptions): Promise<void>
}
