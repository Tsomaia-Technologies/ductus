import { AgentEntity } from './agent-entity.js'
import { ModelEntity } from './model-entity.js'
import { AdapterEntity } from './adapter-entity.js'
import { ReactionEntity } from './reaction-entity.js'
import { ReducerEntity } from './reducer-entity.js'
import { ProcessorEntity } from './processor-entity.js'

export interface FlowEntity<TState> {
  initialState: TState
  reducer: ReducerEntity<TState>
  agents: Array<{ agent: AgentEntity; model: ModelEntity; adapter: AdapterEntity }>
  reactions: Array<ReactionEntity>
  processors: Array<ProcessorEntity<TState>>
}
