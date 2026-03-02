import { EventProcessor } from '../interfaces/event-processor.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { LinkedList } from './linked-list.js'
import { Injector } from '../interfaces/event-generator.js'

export type DuctusReducer<TEvent extends BaseEvent, TState> = (state: TState, event: TEvent) => [TState, TEvent[]]

export interface KernelOptions<TEvent extends BaseEvent, TState> {
  initialState: TState
  reducer: DuctusReducer<TEvent, TState>
  injector: Injector
  multiplexer: Multiplexer<TEvent>
  processors: EventProcessor<TEvent, TState>[]
  ledger: EventLedger<CommittedEvent<TEvent>>
}

export class DuctusKernel<TEvent extends BaseEvent, TState> {
  private readonly multiplexer: Multiplexer<TEvent>
  private readonly processors: EventProcessor<TEvent, TState>[] = []
  private readonly ledger: EventLedger<CommittedEvent<TEvent>>
  private readonly injector: Injector
  private mountResolver: Promise<void[]> = Promise.resolve<void[]>([])
  private reducer: DuctusReducer<TEvent, TState>
  private state: TState
  private getState = () => this.state
  private readonly cascadingEvents = new LinkedList<TEvent>()
  private readonly cascadeWakeUpResolvers = new LinkedList<() => void>()

  constructor(options: KernelOptions<TEvent, TState>) {
    const {
      initialState,
      reducer,
      multiplexer,
      processors,
      ledger,
      injector,
    } = options
    this.state = initialState
    this.reducer = reducer
    this.multiplexer = multiplexer
    this.processors = processors
    this.ledger = ledger
    this.injector = injector
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

  private async mountProcessor(processor: EventProcessor<TEvent, TState>) {
    const subscriber = this.multiplexer.subscribe()
    const eventsIn = subscriber.streamEvents()
    const eventsOut = processor.process(
      eventsIn,
      this.getState,
      this.injector,
    )

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
