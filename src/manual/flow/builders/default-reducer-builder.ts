import { BUILD } from '../../interfaces/flow/builders/__internal__.js'
import { ReducerBuilder } from '../../interfaces/flow/builders/reducer-builder.js'
import { ReducerEntity } from '../../interfaces/flow/entities/reducer-entity.js'
import { BaseEvent } from '../../interfaces/event.js'

export class DefaultReducerBuilder<TEvent extends BaseEvent, TState>
    implements ReducerBuilder<TEvent, TState> {
    private readonly _handlers: {
        event: TEvent
        reduce: (state: TState, event: TEvent) => Partial<TState>
    }[] = []

    private readonly _combined: ReducerBuilder<TEvent, TState>[] = []

    when(
        event: TEvent,
        reduce: (state: TState, event: TEvent) => Partial<TState>
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
            reducer: (state: TState, event: TEvent): TState => {
                let newState = { ...state }

                for (const handler of this._handlers) {
                    if (handler.event === event
                      || (handler.event as any).name === (event as any).name) {
                        newState = { ...newState, ...handler.reduce(newState, event) }
                    }
                }

                for (const child of combinedReducers) {
                    newState = child.reducer(newState, event)
                }

                return newState
            }
        }
    }
}
