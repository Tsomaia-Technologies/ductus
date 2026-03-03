import { EventProcessor } from '../../src/interfaces/event-processor.js'
import { OutputEventStream } from '../../src/interfaces/output-event-stream.js'
import { DuctusState } from '../state/state.js'
import { DuctusEvent } from '../types.js'
import { tick } from '../../src/events/creators.js'

export class TimerProcessor implements EventProcessor<DuctusEvent, DuctusState> {
  async* process(): OutputEventStream<DuctusEvent> {
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      yield tick()
    }
  }
}
