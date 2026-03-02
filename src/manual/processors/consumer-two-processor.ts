import { EventProcessor } from '../interfaces/event-processor.js'
import { OutputEventStream } from '../interfaces/output-event-stream.js'
import { DuctusState } from '../state/state.js'
import { DuctusEvent } from '../events/types.js'
import { InputEventStream } from '../interfaces/input-event-stream.js'

export class ConsumerTwoProcessor implements EventProcessor<DuctusEvent, DuctusState> {
  async* process(events: InputEventStream<DuctusEvent>): OutputEventStream<DuctusEvent> {
    for await (const event of events) {
      if (event.type === 'tick') {
        console.log(`[${ConsumerTwoProcessor.name}] tick`)
      }
    }
  }
}
