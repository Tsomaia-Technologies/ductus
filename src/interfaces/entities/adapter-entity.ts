import { AgentEntity } from './agent-entity.js'
import { ModelEntity } from './model-entity.js'
import { AgentContext } from '../agent-context.js'
import { AgentChunk } from '../agent-chunk.js'

/**
 * Runtime interface for communicating with an AI backend.
 * Created by AdapterEntity.create() — the kernel manages the lifecycle.
 */
export interface AgentAdapter {
  initialize(context?: AgentContext): Promise<void>

  process(input: string): AsyncIterable<AgentChunk>

  terminate(): Promise<void>
}

/**
 * Entity produced by adapter builders.
 * Holds a factory closure that captures config and creates runtime adapters on demand.
 */
export interface AdapterEntity {
  create(agent: AgentEntity, model: ModelEntity): AgentAdapter
}
