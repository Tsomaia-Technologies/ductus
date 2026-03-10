import { ReducerBuilder } from './reducer-builder.js'
import { AgentBuilder } from './agent-builder.js'
import { ModelBuilder } from './model-builder.js'
import { AdapterBuilder } from './adapter-builder.js'
import { ReactionBuilder } from './reaction-builder.js'
import { ProcessorBuilder } from './processor-builder.js'
import { Buildable } from './__internal__.js'
import { FlowEntity } from '../entities/flow-entity.js'
import { ModelEntity } from '../entities/model-entity.js'
import { AgentTransport } from '../agent-transport.js'

export interface FlowBuilder<TState> extends Buildable<FlowEntity<TState>> {
  initialState(state: TState): this

  reducer(reducer: ReducerBuilder<TState>): this

  agent(agent: AgentBuilder, model: ModelBuilder, adapter: AdapterBuilder): this
  agent(agent: AgentBuilder, overrides?: { model?: ModelBuilder | ModelEntity; transport?: AgentTransport }): this

  reaction(reaction: ReactionBuilder): this

  processor(processor: ProcessorBuilder<TState>): this
}
