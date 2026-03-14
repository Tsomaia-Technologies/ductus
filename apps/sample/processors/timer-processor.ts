import { EventProcessor, OutputEventStream, tick } from 'ductus'
import { DuctusState } from '../state/state.js'
import { DuctusEvent } from '../types.js'

export class TimerProcessor implements EventProcessor<DuctusEvent, DuctusState> {
  async* process(): OutputEventStream<DuctusEvent> {
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      yield tick()
    }
  }
}
