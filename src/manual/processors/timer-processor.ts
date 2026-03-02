import { EventProcessor } from '../interfaces/event-processor.js'
import { OutputEventStream } from '../interfaces/output-event-stream.js'
import { DuctusState } from '../state/state.js'
import { DuctusEvent } from '../events/types.js'
import { tick } from '../events/creators.js'

export class TimerProcessor implements EventProcessor<DuctusEvent, DuctusState> {
  async* process(): OutputEventStream<DuctusEvent> {
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      yield tick()
    }
  }
}
