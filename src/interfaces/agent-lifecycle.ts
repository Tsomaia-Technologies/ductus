import { AdapterEntity, AgentAdapter } from './entities/adapter-entity.js'
import { AgentEntity } from './entities/agent-entity.js'
import { ModelEntity } from './entities/model-entity.js'
import { Conversation } from './conversation.js'
import { AgentTransport } from './agent-transport.js'

/** @deprecated Use {@link AgentTupleV2} instead. */
export interface AgentTuple {
  agent: AgentEntity
  model: ModelEntity
  adapter?: AdapterEntity
  /**
   * Flow-level transport override — takes priority over agent.defaultTransport.
   * Lives on this deprecated interface until AgentTuple is fully replaced by AgentTupleV2.
   */
  flowTransport?: AgentTransport
}

export interface AgentTupleV2 {
  agent: AgentEntity
  model?: ModelEntity
  transport?: AgentTransport
}

export interface TurnRecord {
  turnNumber: number
  startSequence: number
  endSequence: number
  failed: boolean
}

/** @deprecated Use {@link AgentLifecycleStateV2} instead. */
export interface AgentLifecycleState {
  tokensUsed: number
  failures: number
  hallucinations: number
  turns: number
  adapter: AgentAdapter
  turnRecords: TurnRecord[]
  currentTurnStartSequence: number
}

export interface AgentLifecycleStateV2 {
  tokensUsed: number
  failures: number
  hallucinations: number
  turns: number
  transport: AgentTransport
  conversation: Conversation
  turnRecords: TurnRecord[]
  currentTurnStartSequence: number
}
