import { AgentEntity } from './entities/agent-entity.js'
import { ModelEntity } from './entities/model-entity.js'
import { Conversation } from './conversation.js'
import { AgentTransport } from './agent-transport.js'

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
