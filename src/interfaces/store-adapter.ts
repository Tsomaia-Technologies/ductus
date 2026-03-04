import { BaseEvent } from './event.js'

export type Reducer<TState, TEvent extends BaseEvent> = (
  state: TState,
  event: TEvent,
) => [TState, TEvent[]]

export interface StoreAdapter<TState, TEvent extends BaseEvent> {
  getState(): TState
  getReducer(): Reducer<TState, TEvent>
  dispatch(event: TEvent): TEvent[]
}
