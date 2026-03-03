import { ReducerBuilder } from './reducer-builder.js'
import { AgentBuilder } from './agent-builder.js'
import { ModelBuilder } from './model-builder.js'
import { ReactionBuilder } from './reaction-builder.js'
import { ProcessorBuilder } from './processor-builder.js'
import { Buildable } from './__internal__.js'
import { FlowEntity } from '../entities/flow-entity.js'
import { BaseEvent } from '../../event.js'

export interface FlowBuilder<TEvent extends BaseEvent, TState>
  extends Buildable<FlowEntity<TEvent, TState>> {
  initialState(state: TState): this
  reducer(reducer: ReducerBuilder<TEvent, TState>): this
  agent(agent: AgentBuilder, model: ModelBuilder): this
  reaction(reaction: ReactionBuilder<TEvent>): this
  processor(processor: ProcessorBuilder<TEvent, TState>): this
}
