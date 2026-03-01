import { EventProcessor } from '../interfaces/event-processor.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { DuctusEvent } from '../events/types.js'
import { CommittedEvent } from '../interfaces/event.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { DuctusState } from '../state/state.js'
import { LinkedList } from './linked-list.js'

export type DuctusReducer = (state: DuctusState, event: DuctusEvent) => [DuctusState, DuctusEvent[]]
export type DuctusEventProcessor = EventProcessor<DuctusState, DuctusEvent, CommittedEvent>

export interface KernelOptions {
  initialState: DuctusState
  reducer: DuctusReducer
  multiplexer: Multiplexer<DuctusEvent, CommittedEvent>
  processors: DuctusEventProcessor[]
  fileAdapter: FileAdapter
  ledger: EventLedger<CommittedEvent>
}

export class DuctusKernel {
  private readonly multiplexer: Multiplexer<DuctusEvent, CommittedEvent>
  private readonly processors: DuctusEventProcessor[] = []
  private readonly ledger: EventLedger<CommittedEvent>
  private mountResolver: Promise<void[]> = Promise.resolve<void[]>([])
  private reducer: DuctusReducer
  private state: DuctusState
  private getState = () => this.state
  private readonly cascadingEvents = new LinkedList<DuctusEvent>()
  private readonly cascadeWakeUpResolvers = new LinkedList<() => void>()

  constructor(options: KernelOptions) {
    const { initialState, reducer, multiplexer, processors, ledger } = options
    this.state = initialState
    this.reducer = reducer
    this.multiplexer = multiplexer
    this.processors = processors
    this.ledger = ledger
  }

  async boot() {
    await this.hydrateStore()
    this.mountStore()

    this.mountResolver = Promise.all([
      ...this.processors.map(processor => this.mountProcessor(processor)),
      this.mountCascadingEvents(),
    ])
  }

  async monitor() {
    await this.mountResolver
  }

  private async hydrateStore() {
    for await (const event of this.ledger.readEvents()) {
      const [state] = this.reducer(this.state, event)
      this.state = state
    }
  }

  private mountStore() {
    this.multiplexer.onCommit(commitedEvent => {
      const [state, eventsOut] = this.reducer(this.state, commitedEvent)
      this.state = state

      for (const event of eventsOut) {
        this.cascadingEvents.insertLast(event)
      }

      const wakeUpCascade = this.cascadeWakeUpResolvers.removeFirst()
      wakeUpCascade?.()
    })
  }

  private async mountProcessor(processor: DuctusEventProcessor) {
    const subscriber = this.multiplexer.subscribe()
    const eventsIn = subscriber.streamEvents()
    const eventsOut = processor.process(eventsIn, this.getState)

    for await (const event of eventsOut) {
      await this.multiplexer.broadcast(event)
    }
  }

  private async mountCascadingEvents() {
    while (true) {
      const event = this.cascadingEvents.removeFirst()

      if (event) {
        await this.multiplexer.broadcast(event)
      } else {
        await new Promise<void>(resolve => {
          this.cascadeWakeUpResolvers.insertLast(resolve)
        })
      }
    }
  }
}
