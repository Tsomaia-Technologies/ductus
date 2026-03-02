import { BUILD } from '../../interfaces/flow/builders/__internal__.js'
import { ReactionBuilder } from '../../interfaces/flow/builders/reaction-builder.js'
import { ReactionEntity } from '../../interfaces/flow/entities/reaction-entity.js'
import { Action } from '../../interfaces/action.js'
import { BaseEvent } from '../../interfaces/event.js'

export class DefaultReactionBuilder<TEvent extends BaseEvent> implements ReactionBuilder<TEvent> {
    private readonly _events: TEvent[] = []
    private readonly _actions: Action<TEvent>[] = []
    private readonly _emits: TEvent[] = []
    private readonly _invokes: string[] = []

    when(...events: TEvent[]): this {
        this._events.push(...events)
        return this
    }

    then(action: Action<TEvent>): this {
        this._actions.push(action)
        return this
    }

    emit(event: TEvent): this {
        this._emits.push(event)
        return this
    }

    invoke(agentSkillId: string): this {
        this._invokes.push(agentSkillId)
        return this
    }

    [BUILD](): ReactionEntity<TEvent> {
        if (this._events.length === 0) {
            throw new Error('Reaction requires at least one event in .when()')
        }

        return {
            events: this._events.map(event => event.type),
            reactions: this._actions,
        }
    }
}
