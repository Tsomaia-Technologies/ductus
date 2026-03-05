import { Reducer, StoreAdapter } from '../interfaces/store-adapter.js'
import { BaseEvent } from '../interfaces/event.js'

export class DuctusStore<TState> implements StoreAdapter<TState> {
  private state: TState

  constructor(
    initialState: TState,
    private readonly reducer: Reducer<TState>,
  ) {
    this.state = initialState
  }

  getState(): TState {
    return this.state
  }

  getReducer(): Reducer<TState> {
    return this.reducer
  }

  dispatch(event: BaseEvent): BaseEvent[] {
    const [state, events] = this.reducer(this.state, event)
    this.state = state

    return events
  }
}
