import { BaseEvent } from '../event.js'

export interface ReducerEntity<TState> {
  reducer: (state: TState, event: BaseEvent) => [TState, BaseEvent[]]
}
