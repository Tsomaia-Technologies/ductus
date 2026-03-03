import { AgentEntity } from './agent-entity.js'
import { ModelEntity } from './model-entity.js'
import { ReactionEntity } from './reaction-entity.js'
import { ReducerEntity } from './reducer-entity.js'
import { ProcessorEntity } from './processor-entity.js'
import { BaseEvent } from '../event.js'

export interface FlowEntity<TEvent extends BaseEvent, TState> {
  initialState: TState
  reducer: ReducerEntity<TEvent, TState>
  agents: Array<{ agent: AgentEntity; model: ModelEntity }>
  reactions: Array<ReactionEntity<TEvent>>
  processors: Array<ProcessorEntity<TEvent, TState>>
}
