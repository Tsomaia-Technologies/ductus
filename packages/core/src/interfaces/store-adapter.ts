import { BaseEvent } from './event.js'

export type Reducer<TState> = (
  state: TState,
  event: BaseEvent,
) => [TState, BaseEvent[]]

export interface StoreAdapter<TState> {
  getState(): TState

  getReducer(): Reducer<TState>

  dispatch(event: BaseEvent): BaseEvent[]

  loadSnapshot?(): Promise<number | null>

  saveSnapshot?(sequenceNumber: number): Promise<void>
}
