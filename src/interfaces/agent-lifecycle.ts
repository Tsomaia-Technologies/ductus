import { AdapterEntity, AgentAdapter } from './entities/adapter-entity.js'
import { AgentEntity } from './entities/agent-entity.js'
import { ModelEntity } from './entities/model-entity.js'
import { Conversation } from './conversation.js'
import { AgentTransport } from './agent-transport.js'

export interface AgentTuple {
  agent: AgentEntity
  model: ModelEntity
  adapter: AdapterEntity
}

export interface TurnRecord {
  turnNumber: number
  startSequence: number
  endSequence: number
  failed: boolean
}

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
