import { BUILD } from '../interfaces/builders/__internal__.js'
import { ReducerBuilder } from '../interfaces/builders/reducer-builder.js'
import { ReducerEntity } from '../interfaces/entities/reducer-entity.js'
import { BaseEvent } from '../interfaces/event.js'

export class DefaultReducerBuilder<TEvent extends BaseEvent, TState>
    implements ReducerBuilder<TEvent, TState> {
    private readonly _handlers: {
        event: TEvent
        reduce: (state: TState, event: TEvent) => [Partial<TState>, TEvent[]]
    }[] = []

    private readonly _combined: ReducerBuilder<TEvent, TState>[] = []

    when(
        event: TEvent,
        reduce: (state: TState, event: TEvent) => [Partial<TState>, TEvent[]]
    ): this {
        this._handlers.push({ event, reduce })
        return this
    }

    combine(reducer: ReducerBuilder<TEvent, TState>): this {
        this._combined.push(reducer)
        return this
    }

    [BUILD](): ReducerEntity<TEvent, TState> {
        const combinedReducers = this._combined.map((r) => r[BUILD]())

        return {
            reducer: (state: TState, event: TEvent): [TState, TEvent[]] => {
                let newState = { ...state }
                const accumulatedEvents: TEvent[] = []

                for (const handler of this._handlers) {
                    if (handler.event.type === event.type) {
                        const [partial, eventsOut] = handler.reduce(newState, event)
                        newState = { ...newState, ...partial }
                        accumulatedEvents.push(...eventsOut)
                    }
                }

                for (const child of combinedReducers) {
                    const [s, eventsOut] = child.reducer(newState, event)
                    newState = s
                    accumulatedEvents.push(...eventsOut)
                }

                return [newState, accumulatedEvents]
            }
        }
    }
}
