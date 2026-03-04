import { Reducer, StoreAdapter } from '../interfaces/store-adapter.js'
import { BaseEvent } from '../interfaces/event.js'

export class DuctusStore<TState, TEvent extends BaseEvent>
  implements StoreAdapter<TState, TEvent> {
  private state: TState

  constructor(
    private readonly initialState: TState,
    private readonly reducer: Reducer<TState, TEvent>,
  ) {
    this.state = initialState
  }

  getState(): TState {
    return this.state
  }

  getReducer(): Reducer<TState, TEvent> {
    return this.reducer
  }

  dispatch(event: TEvent): TEvent[] {
    const [state, events] = this.reducer(this.state, event)
    this.state = state

    return events
  }
}
