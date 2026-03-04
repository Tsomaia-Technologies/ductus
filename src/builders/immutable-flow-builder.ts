import { BUILD } from '../interfaces/builders/__internal__.js'
import { FlowBuilder } from '../interfaces/builders/flow-builder.js'
import { ReducerBuilder } from '../interfaces/builders/reducer-builder.js'
import { AgentBuilder } from '../interfaces/builders/agent-builder.js'
import { ModelBuilder } from '../interfaces/builders/model-builder.js'
import { AdapterBuilder } from '../interfaces/builders/adapter-builder.js'
import { ReactionBuilder } from '../interfaces/builders/reaction-builder.js'
import { ProcessorBuilder } from '../interfaces/builders/processor-builder.js'
import { FlowEntity } from '../interfaces/entities/flow-entity.js'
import { BaseEvent } from '../interfaces/event.js'

interface FlowAgentEntry {
  agent: AgentBuilder
  model: ModelBuilder
  adapter: AdapterBuilder
}

interface FlowBuilderParams<TEvent extends BaseEvent, TState> {
  initialState?: TState
  reducer?: ReducerBuilder<TEvent, TState>
  readonly agents: FlowAgentEntry[]
  readonly reactions: ReactionBuilder<TEvent>[]
  readonly processors: ProcessorBuilder<TEvent, TState>[]
}

export class ImmutableFlowBuilder<TEvent extends BaseEvent, TState> implements FlowBuilder<TEvent, TState> {
  private params: FlowBuilderParams<TEvent, TState>

  constructor() {
    this.params = {
      agents: [],
      reactions: [],
      processors: [],
    }
  }

  initialState(state: TState): this {
    return this.clone({ initialState: state })
  }

  reducer(reducer: ReducerBuilder<TEvent, TState>): this {
    return this.clone({ reducer })
  }

  agent(agent: AgentBuilder, model: ModelBuilder, adapter: AdapterBuilder): this {
    return this.clone({
      agents: [...this.params.agents, { agent, model, adapter }]
    })
  }

  reaction(reaction: ReactionBuilder<TEvent>): this {
    return this.clone({
      reactions: [...this.params.reactions, reaction]
    })
  }

  processor(processor: ProcessorBuilder<TEvent, TState>): this {
    return this.clone({
      processors: [...this.params.processors, processor]
    })
  }

  [BUILD](): FlowEntity<TEvent, TState> {
    if (this.params.initialState === undefined) throw new Error('Flow requires initialState.')
    if (!this.params.reducer) throw new Error('Flow requires reducer.')

    return {
      initialState: this.params.initialState,
      reducer: this.params.reducer[BUILD](),
      agents: this.params.agents.map((a) => ({
        agent: a.agent[BUILD](),
        model: a.model[BUILD](),
        adapter: a.adapter[BUILD](),
      })),
      reactions: this.params.reactions.map((r) => r[BUILD]()),
      processors: this.params.processors.map((p) => p[BUILD]()),
    }
  }

  private clone(params: Partial<FlowBuilderParams<TEvent, TState>>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
