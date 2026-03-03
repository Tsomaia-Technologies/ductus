import { ModelEntity } from './model-entity.js'
import { AgentContext } from '../agent-context.js'
import { CancellationToken } from '../cancellation-token.js'

export interface TransportProcessOptions {
  canceller?: CancellationToken
}

export interface TransportEntity {
  initialize(model: ModelEntity, context?: AgentContext): Promise<void>
  process(input: string, options: TransportProcessOptions): Promise<void>
}
