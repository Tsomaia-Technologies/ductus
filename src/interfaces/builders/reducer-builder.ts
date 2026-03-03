import { Buildable } from './__internal__.js'
import { ReducerEntity } from '../entities/reducer-entity.js'
import { BaseEvent } from '../event.js'

export interface ReducerBuilder<TEvent extends BaseEvent, TState>
  extends Buildable<ReducerEntity<TEvent, TState>> {
  when(
    event: TEvent,
    reduce: (state: TState, event: TEvent) => [Partial<TState>, TEvent[]],
  ): this
  combine(reducer: ReducerBuilder<TEvent, TState>): this
}
