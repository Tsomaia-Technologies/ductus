import { BUILD } from '../interfaces/builders/__internal__.js'
import { ReducerBuilder } from '../interfaces/builders/reducer-builder.js'
import { ReducerEntity } from '../interfaces/entities/reducer-entity.js'
import { BaseEvent } from '../interfaces/event.js'

interface ReducerHandler<TEvent extends BaseEvent, TState> {
  event: TEvent
  reduce: (state: TState, event: TEvent) => [Partial<TState>, TEvent[]]
}

interface ReducerBuilderParams<TEvent extends BaseEvent, TState> {
  readonly handlers: ReducerHandler<TEvent, TState>[]
  readonly combined: ReducerBuilder<TEvent, TState>[]
}

export class ImmutableReducerBuilder<TEvent extends BaseEvent, TState>
  implements ReducerBuilder<TEvent, TState> {
  private params: ReducerBuilderParams<TEvent, TState>

  constructor() {
    this.params = {
      handlers: [],
      combined: [],
    }
  }

  when(
    event: TEvent,
    reduce: (state: TState, event: TEvent) => [Partial<TState>, TEvent[]],
  ): this {
    return this.clone({
      handlers: [...this.params.handlers, { event, reduce }]
    })
  }

  combine(reducer: ReducerBuilder<TEvent, TState>): this {
    return this.clone({
      combined: [...this.params.combined, reducer]
    })
  }

  [BUILD](): ReducerEntity<TEvent, TState> {
    const handlers = [...this.params.handlers]
    const combinedReducers = this.params.combined.map((r) => r[BUILD]())

    return {
      reducer: (state: TState, event: TEvent): [TState, TEvent[]] => {
        let newState = { ...state }
        const accumulatedEvents: TEvent[] = []

        for (const handler of handlers) {
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
      },
    }
  }

  private clone(params: Partial<ReducerBuilderParams<TEvent, TState>>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
