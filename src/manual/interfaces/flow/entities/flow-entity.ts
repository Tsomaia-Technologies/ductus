import { AgentEntity } from './agent-entity.js'
import { ModelEntity } from './model-entity.js'
import { ReactionEntity } from './reaction-entity.js'
import { EventGenerator } from '../../event-generator.js'
import { ReducerEntity } from './reducer-entity.js'

export interface FlowEntity<TEvent, TState> {
  initialState: TState
  reducer: ReducerEntity<TEvent, TState>
  agents: Array<{ agent: AgentEntity; model: ModelEntity }>
  reactions: Array<ReactionEntity<TEvent>>
  processors: Array<EventGenerator<TEvent, TState>>
}
