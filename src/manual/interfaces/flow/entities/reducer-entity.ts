export interface ReducerEntity<TEvent, TState> {
  reducer: (state: TState, event: TEvent) => TState
}
