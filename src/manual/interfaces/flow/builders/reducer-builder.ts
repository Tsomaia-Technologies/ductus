import { Buildable } from './__internal__.js'
import { ReducerEntity } from '../entities/reducer-entity.js'

export interface ReducerBuilder<TEvent extends BaseEvent, TState>
  extends Buildable<ReducerEntity<TEvent, TState>> {
  when(
    event: TEvent,
    reduce: (state: TState, event: TEvent) => Partial<TState>,
  ): this
  combine(reducer: ReducerBuilder<TEvent, TState>): this
}
