import { EventProcessor } from '../interfaces/event-processor.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { DuctusEvent } from '../events/types.js'
import { CommittedEvent } from '../interfaces/event.js'

export interface KernelOptions {
  multiplexer: Multiplexer<DuctusEvent, CommittedEvent>
  processors: EventProcessor[]
}

export class Kernel {
  private processors: EventProcessor[] = []

  constructor(processors: EventProcessor[]) {
    this.processors = processors
  }

  boot() {

  }

  private mount(processor: EventProcessor) {

  }
}
