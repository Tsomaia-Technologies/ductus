import { BUILD } from '../interfaces/builders/__internal__.js'
import { ReducerBuilder } from '../interfaces/builders/reducer-builder.js'
import { ReducerEntity } from '../interfaces/entities/reducer-entity.js'
import { BaseEvent, EventDefinition, EventPayloadShape } from '../interfaces/event.js'

interface ReducerHandler<TState> {
  event: EventDefinition
  reduce: (state: TState, event: BaseEvent) => [Partial<TState>, BaseEvent[]]
}

interface ReducerBuilderParams<TState> {
  readonly handlers: ReducerHandler<TState>[]
  readonly combined: ReducerBuilder<TState>[]
}

export class ImmutableReducerBuilder<TState> implements ReducerBuilder<TState> {
  private params: ReducerBuilderParams<TState>

  constructor() {
    this.params = {
      handlers: [],
      combined: [],
    }
  }

  when<T extends string, P extends EventPayloadShape>(
    event: EventDefinition<T, P>,
    reduce: (state: TState, event: BaseEvent) => [Partial<TState>, BaseEvent[]],
  ): this {
    return this.clone({
      handlers: [...this.params.handlers, { event, reduce }]
    })
  }

  combine(reducer: ReducerBuilder<TState>): this {
    return this.clone({
      combined: [...this.params.combined, reducer]
    })
  }

  [BUILD](): ReducerEntity<TState> {
    const handlers = [...this.params.handlers]
    const combinedReducers = this.params.combined.map((r) => r[BUILD]())

    return {
      reducer: (state: TState, event: BaseEvent): [TState, BaseEvent[]] => {
        let newState = { ...state }
        const accumulatedEvents: BaseEvent[] = []

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

  private clone(params: Partial<ReducerBuilderParams<TState>>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
