import { EventProcessor } from '../interfaces/event-processor.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { LinkedList } from './linked-list.js'
import { DependencyContainer } from '../interfaces/dependency-container.js'
import { CancellationToken } from '../interfaces/cancellation-token.js'
import { Canceller } from '../system/canceller.js'
import { EventSubscriber } from '../interfaces/event-subscriber.js'

export type DuctusReducer<TEvent extends BaseEvent, TState> = (state: TState, event: TEvent) => [TState, TEvent[]]

export interface KernelOptions<TEvent extends BaseEvent, TState> {
  initialState: TState
  reducer: DuctusReducer<TEvent, TState>
  injector: DependencyContainer
  multiplexer: Multiplexer<TEvent>
  processors: EventProcessor<TEvent, TState>[]
  ledger: EventLedger<CommittedEvent<TEvent>>
  canceller?: CancellationToken
}

export class DuctusKernel<TEvent extends BaseEvent, TState> {
  private readonly multiplexer: Multiplexer<TEvent>
  private readonly processors: EventProcessor<TEvent, TState>[] = []
  private readonly ledger: EventLedger<CommittedEvent<TEvent>>
  private readonly injector: DependencyContainer
  private readonly canceller: Canceller
  private readonly subscribers: EventSubscriber<CommittedEvent<TEvent>>[] = []
  private mountResolver: Promise<void[]> = Promise.resolve<void[]>([])
  private reducer: DuctusReducer<TEvent, TState>
  private state: TState
  private getState = () => this.state
  private readonly cascadingEvents = new LinkedList<TEvent>()
  private readonly cascadeWakeUpResolvers = new LinkedList<() => void>()
  private unsubscribeCommit?: () => void

  constructor(options: KernelOptions<TEvent, TState>) {
    const {
      initialState,
      reducer,
      multiplexer,
      processors,
      ledger,
      injector,
      canceller,
    } = options
    this.state = initialState
    this.reducer = reducer
    this.multiplexer = multiplexer
    this.processors = processors
    this.ledger = ledger
    this.injector = injector
    this.canceller = new Canceller({ base: canceller })
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

  async shutdown(options?: { force?: boolean }) {
    const force = options?.force ?? false
    this.canceller.cancel({ force })

    // Unsubscribe all processor subscribers
    for (const subscriber of this.subscribers) {
      subscriber.unsubscribe({ drain: !force })
    }

    // Wake up the cascade loop so it can check the cancel flag and exit
    let wakeUp: (() => void) | null = null
    while (wakeUp = this.cascadeWakeUpResolvers.removeFirst()) {
      wakeUp()
    }

    // Deregister the commit listener
    this.unsubscribeCommit?.()

    // Wait for all loops to exit
    await this.mountResolver
  }

  private async hydrateStore() {
    for await (const event of this.ledger.readEvents()) {
      const [state] = this.reducer(this.state, event)
      this.state = state
    }
  }

  private mountStore() {
    this.unsubscribeCommit = this.multiplexer.onCommit(commitedEvent => {
      const [state, eventsOut] = this.reducer(this.state, commitedEvent)
      this.state = state

      if (this.canceller.isCancelled()) return

      for (const event of eventsOut) {
        this.cascadingEvents.insertLast(event)
      }

      const wakeUpCascade = this.cascadeWakeUpResolvers.removeFirst()
      wakeUpCascade?.()
    })
  }

  private async mountProcessor(processor: EventProcessor<TEvent, TState>) {
    const subscriber = this.multiplexer.subscribe()
    this.subscribers.push(subscriber)

    const eventsIn = subscriber.streamEvents()
    const eventsOut = processor.process(
      eventsIn,
      this.getState,
      this.injector.use.bind(this.injector),
    )

    for await (const event of eventsOut) {
      if (this.canceller.isCancelled()) break
      await this.multiplexer.broadcast(event)
    }
  }

  private async mountCascadingEvents() {
    while (!this.canceller.isCancelled()) {
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
