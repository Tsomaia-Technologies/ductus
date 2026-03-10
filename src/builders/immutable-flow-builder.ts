import { build, BUILD, isBuildable } from '../interfaces/builders/__internal__.js'
import { FlowBuilder } from '../interfaces/builders/flow-builder.js'
import { ReducerBuilder } from '../interfaces/builders/reducer-builder.js'
import { AgentBuilder } from '../interfaces/builders/agent-builder.js'
import { ModelBuilder } from '../interfaces/builders/model-builder.js'
import { AdapterBuilder } from '../interfaces/builders/adapter-builder.js'
import { ReactionBuilder } from '../interfaces/builders/reaction-builder.js'
import { ProcessorBuilder } from '../interfaces/builders/processor-builder.js'
import { FlowEntity, FlowAgentRegistration } from '../interfaces/entities/flow-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { AgentTransport } from '../interfaces/agent-transport.js'

interface FlowAgentEntry {
  agent: AgentBuilder
  model?: ModelBuilder
  adapter?: AdapterBuilder
  modelEntity?: ModelEntity
  transport?: AgentTransport
}

interface FlowBuilderParams<TState> {
  initialState?: TState
  reducer?: ReducerBuilder<TState>
  readonly agents: FlowAgentEntry[]
  readonly reactions: ReactionBuilder[]
  readonly processors: ProcessorBuilder<TState>[]
}

export class ImmutableFlowBuilder<TState> implements FlowBuilder<TState> {
  private params: FlowBuilderParams<TState>

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

  reducer(reducer: ReducerBuilder<TState>): this {
    return this.clone({ reducer })
  }

  agent(
    agent: AgentBuilder,
    modelOrOverrides?: ModelBuilder | { model?: ModelBuilder | ModelEntity; transport?: AgentTransport },
    adapter?: AdapterBuilder,
  ): this {
    if (adapter !== undefined) {
      return this.clone({
        agents: [...this.params.agents, { agent, model: modelOrOverrides as ModelBuilder, adapter }],
      })
    }

    if (modelOrOverrides && !isBuildable(modelOrOverrides)) {
      const overrides = modelOrOverrides as { model?: ModelBuilder | ModelEntity; transport?: AgentTransport }
      const resolvedModel = overrides.model && isBuildable(overrides.model)
        ? undefined
        : (overrides.model as ModelEntity | undefined)
      const modelBuilder = overrides.model && isBuildable(overrides.model)
        ? (overrides.model as unknown as ModelBuilder)
        : undefined

      return this.clone({
        agents: [...this.params.agents, {
          agent,
          model: modelBuilder,
          modelEntity: resolvedModel,
          transport: overrides.transport,
        }],
      })
    }

    return this.clone({
      agents: [...this.params.agents, { agent }],
    })
  }

  reaction(reaction: ReactionBuilder): this {
    return this.clone({
      reactions: [...this.params.reactions, reaction],
    })
  }

  processor(processor: ProcessorBuilder<TState>): this {
    return this.clone({
      processors: [...this.params.processors, processor],
    })
  }

  [BUILD](): FlowEntity<TState> {
    if (this.params.initialState === undefined) throw new Error('Flow requires initialState.')
    if (!this.params.reducer) throw new Error('Flow requires reducer.')

    return {
      initialState: this.params.initialState,
      reducer: build(this.params.reducer),
      agents: this.params.agents.map((a) => {
        const registration: FlowAgentRegistration = {
          agent: build(a.agent),
        }
        if (a.model) registration.model = build(a.model)
        if (a.modelEntity) registration.model = a.modelEntity
        if (a.adapter) registration.adapter = build(a.adapter)
        if (a.transport) registration.transport = a.transport
        return registration
      }),
      reactions: this.params.reactions.map(build),
      processors: this.params.processors.map(build),
    }
  }

  private clone(params: Partial<FlowBuilderParams<TState>>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
