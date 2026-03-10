import { AgentEntity } from './agent-entity.js'
import { ModelEntity } from './model-entity.js'
import { AdapterEntity } from './adapter-entity.js'
import { AgentTransport } from '../agent-transport.js'
import { ReactionEntity } from './reaction-entity.js'
import { ReducerEntity } from './reducer-entity.js'
import { ProcessorEntity } from './processor-entity.js'

export interface FlowAgentRegistration {
  agent: AgentEntity
  model?: ModelEntity
  transport?: AgentTransport
  adapter?: AdapterEntity
}

export interface FlowEntity<TState> {
  initialState: TState
  reducer: ReducerEntity<TState>
  agents: FlowAgentRegistration[]
  reactions: Array<ReactionEntity>
  processors: Array<ProcessorEntity<TState>>
}
