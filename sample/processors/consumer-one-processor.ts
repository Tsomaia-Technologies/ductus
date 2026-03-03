import { EventProcessor, InputEventStream, OutputEventStream } from 'ductus'
import { DuctusState } from '../state/state.js'
import { DuctusEvent } from '../types.js'

export class ConsumerOneProcessor implements EventProcessor<DuctusEvent, DuctusState> {
  async* process(events: InputEventStream<DuctusEvent>): OutputEventStream<DuctusEvent> {
    for await (const event of events) {
      if (event.type === 'tick') {
        console.log(`[${ConsumerOneProcessor.name}] tick`)
      }
    }
  }
}
