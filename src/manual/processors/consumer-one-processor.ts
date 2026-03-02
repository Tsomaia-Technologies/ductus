import { EventProcessor } from '../interfaces/event-processor.js'
import { OutputEventStream } from '../interfaces/output-event-stream.js'
import { DuctusState } from '../state/state.js'
import { DuctusEvent } from '../events/types.js'
import { InputEventStream } from '../interfaces/input-event-stream.js'

export class ConsumerOneProcessor implements EventProcessor<DuctusState, DuctusEvent> {
  async* process(events: InputEventStream): OutputEventStream {
    for await (const event of events) {
      if (event.type === 'tick') {
        console.log(`[${ConsumerOneProcessor.name}] tick`)
      }
    }
  }
}
