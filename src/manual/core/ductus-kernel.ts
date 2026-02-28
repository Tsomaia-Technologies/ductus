import { EventProcessor } from '../interfaces/event-processor.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { DuctusEvent } from '../events/types.js'
import { CommittedEvent } from '../interfaces/event.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { EventLedger } from '../interfaces/event-ledger.js'

export interface KernelOptions {
  multiplexer: Multiplexer<DuctusEvent, CommittedEvent>
  processors: EventProcessor[]
  fileAdapter: FileAdapter
  ledger: EventLedger<CommittedEvent>
}

export class DuctusKernel {
  private readonly multiplexer: Multiplexer<DuctusEvent, CommittedEvent>
  private readonly processors: EventProcessor[] = []
  private readonly ledger: EventLedger<CommittedEvent>
  private mountResolver: Promise<void[]> = Promise.resolve<void[]>([])

  constructor(options: KernelOptions) {
    const { multiplexer, processors, ledger } = options
    this.multiplexer = multiplexer
    this.processors = processors
    this.ledger = ledger
  }

  async boot() {
    this.mountResolver = Promise.all(
      this.processors.map(processor => this.mount(processor))
    )
    await this.hydrate()
  }

  async monitor() {
    await this.mountResolver
  }

  private async hydrate() {
    for await (const event of this.ledger.readEvents()) {
      await this.multiplexer.replay(event)
    }
  }

  private async mount(processor: EventProcessor) {
    const subscriber = this.multiplexer.subscribe()
    const eventsIn = subscriber.streamEvents()
    const eventsOut = processor.process(eventsIn)

    for await (const event of eventsOut) {
      await this.multiplexer.broadcast(event)
    }
  }
}
