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

export class DefaultFlowBuilder<TEvent extends BaseEvent, TState> implements FlowBuilder<TEvent, TState> {
    private _initialState?: TState
    private _reducer?: ReducerBuilder<TEvent, TState>
    private readonly _agents: { agent: AgentBuilder; model: ModelBuilder; adapter: AdapterBuilder }[] = []
    private readonly _reactions: ReactionBuilder<TEvent>[] = []
    private readonly _processors: ProcessorBuilder<TEvent, TState>[] = []

    initialState(state: TState): this {
        this._initialState = state
        return this
    }

    reducer(reducer: ReducerBuilder<TEvent, TState>): this {
        this._reducer = reducer
        return this
    }

    agent(agent: AgentBuilder, model: ModelBuilder, adapter: AdapterBuilder): this {
        this._agents.push({ agent, model, adapter })
        return this
    }

    reaction(reaction: ReactionBuilder<TEvent>): this {
        this._reactions.push(reaction)
        return this
    }

    processor(processor: ProcessorBuilder<TEvent, TState>): this {
        this._processors.push(processor)
        return this
    }

    [BUILD](): FlowEntity<TEvent, TState> {
        if (this._initialState === undefined) throw new Error('Flow requires initialState.')
        if (!this._reducer) throw new Error('Flow requires reducer.')

        return {
            initialState: this._initialState,
            reducer: this._reducer[BUILD](),
            agents: this._agents.map((a) => ({
                agent: a.agent[BUILD](),
                model: a.model[BUILD](),
                adapter: a.adapter[BUILD](),
            })),
            reactions: this._reactions.map((r) => r[BUILD]()),
            processors: this._processors.map((p) => p[BUILD]()),
        }
    }
}
