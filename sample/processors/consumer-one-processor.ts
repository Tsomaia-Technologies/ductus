import { EventProcessor } from '../../src/interfaces/event-processor.js'
import { OutputEventStream } from '../../src/interfaces/output-event-stream.js'
import { DuctusState } from '../state/state.js'
import { DuctusEvent } from '../types.js'
import { InputEventStream } from '../../src/interfaces/input-event-stream.js'

export class ConsumerOneProcessor implements EventProcessor<DuctusEvent, DuctusState> {
  async* process(events: InputEventStream<DuctusEvent>): OutputEventStream<DuctusEvent> {
    for await (const event of events) {
      if (event.type === 'tick') {
        console.log(`[${ConsumerOneProcessor.name}] tick`)
      }
    }
  }
}
