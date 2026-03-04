import { AgentAdapter, AdapterEntity } from './entities/adapter-entity.js'
import { AgentEntity } from './entities/agent-entity.js'
import { ModelEntity } from './entities/model-entity.js'

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
