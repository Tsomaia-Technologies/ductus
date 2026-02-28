import { EventProcessor } from '../interfaces/event-processor.js'
import { InputEventStream } from '../interfaces/input-event-stream.js'
import { OutputEventStream } from '../interfaces/output-event-stream.js'
import { ductusReducer } from '../state/reducer.js'
import { DuctusState } from '../state/state.js'

export class StateProcessor implements EventProcessor {
  private currentState: DuctusState

  constructor(initialState: DuctusState) {
    this.currentState = initialState
  }

  async* process(events: InputEventStream): OutputEventStream {
    for await (const event of events) {
      const [newState, newEvents] = ductusReducer(this.currentState, event)
      this.currentState = newState
      yield* newEvents
    }
  }
}
