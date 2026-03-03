import { BaseEvent } from '../event.js'

export interface ReducerEntity<TEvent extends BaseEvent, TState> {
  reducer: (state: TState, event: TEvent) => [TState, TEvent[]]
}
