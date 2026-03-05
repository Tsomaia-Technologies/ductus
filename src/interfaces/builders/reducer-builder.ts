import { Buildable } from './__internal__.js'
import { ReducerEntity } from '../entities/reducer-entity.js'
import { BaseEvent, EventDefinition, EventPayloadShape } from '../event.js'

export interface ReducerBuilder<TState>
  extends Buildable<ReducerEntity<TState>> {
  when<T extends string, P extends EventPayloadShape>(
    event: EventDefinition<T, P>,
    reduce: (state: TState, event: BaseEvent) => [Partial<TState>, BaseEvent[]],
  ): this

  combine(reducer: ReducerBuilder<TState>): this
}
