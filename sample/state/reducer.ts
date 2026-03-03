import { DuctusState } from './state.js'
import { DuctusEvent } from '../types.js'

export type DuctusReducer = (
  state: DuctusState,
  event: DuctusEvent,
) => [DuctusState, DuctusEvent[]]

const reducers: DuctusReducer[] = [

]

export function ductusReducer(
  state: DuctusState,
  event: DuctusEvent,
): [DuctusState, DuctusEvent[]] {
  return reducers.reduce(([currentState, accumulatedEvents], currentReducer) => {
    const [newState, newEvents] = currentReducer(currentState, event)

    return [newState, [...accumulatedEvents, ...newEvents]]
  }, [state, [] as DuctusEvent[]])
}
