import { EventProcessor } from '../interfaces/event-processor.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { LinkedList } from './linked-list.js'
import { CancellationToken } from '../interfaces/cancellation-token.js'
import { Canceller } from '../system/canceller.js'
import { EventSubscriber } from '../interfaces/event-subscriber.js'
import { Injector } from '../interfaces/event-generator.js'
import { StoreAdapter } from '../interfaces/store-adapter.js'

export type DuctusReducer<TEvent extends BaseEvent, TState> = (state: TState, event: TEvent) => [TState, TEvent[]]

export interface KernelOptions<TEvent extends BaseEvent, TState> {
  injector: Injector,
  multiplexer: Multiplexer<TEvent>
  processors: EventProcessor<TEvent, TState>[]
  ledger: EventLedger<CommittedEvent<TEvent>>
  store: StoreAdapter<TState, TEvent>
  canceller?: CancellationToken
  snapshotPredicate?: (eventsProcessed: number) => boolean
}

export class DuctusKernel<TEvent extends BaseEvent, TState> {
  private readonly multiplexer: Multiplexer<TEvent>
  private readonly processors: EventProcessor<TEvent, TState>[] = []
  private readonly ledger: EventLedger<CommittedEvent<TEvent>>
  private readonly store: StoreAdapter<TState, TEvent>
  private readonly use: Injector
  private readonly getState: () => TState
  private readonly canceller: Canceller
  private readonly subscribers: EventSubscriber<CommittedEvent<TEvent>>[] = []
  private mountResolver: Promise<void[]> = Promise.resolve<void[]>([])
  private readonly cascadingEvents = new LinkedList<{ event: TEvent; context: { causationId: string; correlationId: string } }>()
  private readonly cascadeWakeUpResolvers = new LinkedList<() => void>()
  private unsubscribeCommit?: () => void
  private readonly snapshotPredicate?: (eventsProcessed: number) => boolean
  private eventsProcessedSinceSnapshot = 0

  constructor(options: KernelOptions<TEvent, TState>) {
    const {
      multiplexer,
      processors,
      ledger,
      store,
      injector,
      canceller,
      snapshotPredicate,
    } = options
    this.multiplexer = multiplexer
    this.processors = processors
    this.ledger = ledger
    this.store = store
    this.getState = this.store.getState.bind(this.store)
    this.use = injector
    this.canceller = new Canceller({ base: canceller })
    this.snapshotPredicate = snapshotPredicate
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
    let afterSequence = 0
    if (this.store.loadSnapshot) {
      const restoredSeq = await this.store.loadSnapshot()
      if (restoredSeq != null) {
        afterSequence = restoredSeq
      }
    }

    for await (const event of this.ledger.readEvents({ afterSequence })) {
      this.store.dispatch(event)
      this.eventsProcessedSinceSnapshot++
    }
  }

  private mountStore() {
    this.unsubscribeCommit = this.multiplexer.onCommit(commitedEvent => {
      const eventsOut = this.store.dispatch(commitedEvent)

      this.eventsProcessedSinceSnapshot++
      if (this.store.saveSnapshot && this.snapshotPredicate?.(this.eventsProcessedSinceSnapshot)) {
        this.eventsProcessedSinceSnapshot = 0
        this.store.saveSnapshot(commitedEvent.sequenceNumber).catch(console.error)
      }

      if (this.canceller.isCancelled()) return

      const correlationId = commitedEvent.correlationId || commitedEvent.eventId

      for (const event of eventsOut) {
        this.cascadingEvents.insertLast({
          event,
          context: {
            causationId: commitedEvent.eventId,
            correlationId,
          }
        })
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
      this.use,
    )

    for await (const event of eventsOut) {
      if (this.canceller.isCancelled()) break
      await this.multiplexer.broadcast(event)
    }
  }

  private async mountCascadingEvents() {
    while (!this.canceller.isCancelled()) {
      const wrapper = this.cascadingEvents.removeFirst()

      if (wrapper) {
        await this.multiplexer.broadcast(wrapper.event, wrapper.context)
      } else {
        await new Promise<void>(resolve => {
          this.cascadeWakeUpResolvers.insertLast(resolve)
        })
      }
    }
  }
}
