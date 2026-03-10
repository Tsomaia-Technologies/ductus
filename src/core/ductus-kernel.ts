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
import { DeeplyReadonly } from '../interfaces/helpers.js'
import { BootEvent } from './events.js'
import { IntentProcessor } from './intent-processor.js'
import { EventSequencer } from '../interfaces/event-sequencer.js'

export interface KernelOptions<TState> {
  injector: Injector,
  multiplexer: Multiplexer
  sequencer: EventSequencer
  processors: EventProcessor<TState>[]
  ledger: EventLedger
  store: StoreAdapter<TState>
  canceller?: CancellationToken
  shouldTakeSnapshot?: (state: DeeplyReadonly<TState>, event: CommittedEvent) => boolean
}

export class DuctusKernel<TState> {
  private readonly multiplexer: Multiplexer
  private readonly sequencer: EventSequencer
  private readonly processors: EventProcessor<TState>[] = []
  private readonly ledger: EventLedger
  private readonly store: StoreAdapter<TState>
  private readonly use: Injector
  private readonly getState: () => TState
  private readonly canceller: Canceller
  private readonly subscribers: EventSubscriber[] = []
  private mountResolver: Promise<void[]> = Promise.resolve<void[]>([])
  private readonly cascadingEvents = new LinkedList<{
    event: BaseEvent;
    context: { causationId: string; correlationId: string }
  }>()
  private readonly cascadeWakeUpResolvers = new LinkedList<() => void>()
  private unsubscribeCommit?: () => void
  private readonly shouldTakeSnapshot?: (state: DeeplyReadonly<TState>, event: CommittedEvent) => boolean
  private readonly causationGraph = new Map<string, { type: string, causationId?: string, sequence: number }>()
  private isShuttingDown = false
  private isShutDownStarted = false
  private readonly intentProcessor: IntentProcessor

  constructor(options: KernelOptions<TState>) {
    const {
      multiplexer,
      sequencer,
      processors,
      ledger,
      store,
      injector,
      canceller,
      shouldTakeSnapshot,
    } = options
    this.multiplexer = multiplexer
    this.sequencer = sequencer
    this.processors = processors
    this.ledger = ledger
    this.store = store
    this.getState = this.store.getState.bind(this.store)
    this.use = injector
    this.canceller = new Canceller({ base: canceller })
    this.shouldTakeSnapshot = shouldTakeSnapshot
    this.intentProcessor = new IntentProcessor(
      this.multiplexer,
      this.sequencer,
    )
  }

  async boot() {
    await this.hydrateStore()
    this.mountStore()

    this.mountResolver = Promise.all([
      ...this.processors.map(processor => this.mountProcessor(processor)),
      this.mountCascadingEvents(),
    ])

    await this.multiplexer.broadcast(
      BootEvent({ timestamp: Date.now() })
    )
  }

  async monitor() {
    await this.mountResolver
  }

  async shutdown(options?: { force?: boolean }) {
    const force = options?.force ?? false

    if (this.isShutDownStarted) {
      if (force) this.canceller.cancel({ force: true })
      return
    }

    this.isShutDownStarted = true

    if (force) {
      this.canceller.cancel({ force })
    } else {
      this.isShuttingDown = true
    }

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
    const timeoutPromise = new Promise<void>((_, reject) =>
      setTimeout(() => {
        this.canceller.cancel({ force: true }) // Force kill the loops on timeout
        reject(new Error('Kernel shutdown timed out waiting for processors to exit.'))
      }, 5000)
    )

    try {
      await Promise.race([this.mountResolver, timeoutPromise])
    } catch (e: any) {
      console.warn(`Ductus Framework Warning: ${e.message}`)
    } finally {
      await this.ledger.dispose()
    }
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
    }
  }

  private mountStore() {
    this.unsubscribeCommit = this.sequencer.onCommit(({ event: commitedEvent }) => {
      // Record Graph Node for Cycle Detection
      this.causationGraph.set(commitedEvent.eventId, {
        type: commitedEvent.type,
        causationId: commitedEvent.causationId,
        sequence: commitedEvent.sequenceNumber,
      })

      // Run sliding window eviction to prevent memory leak
      if (commitedEvent.sequenceNumber % 100 === 0) {
        const threshold = commitedEvent.sequenceNumber - 5000
        for (const [key, node] of this.causationGraph.entries()) {
          if (node.sequence < threshold) {
            this.causationGraph.delete(key)
          } else {
            break // Map preserves insertion order, break early
          }
        }
      }

      if (commitedEvent.volatility === 'volatile') return

      const eventsOut = this.store.dispatch(commitedEvent)

      if (this.store.saveSnapshot && this.shouldTakeSnapshot?.(this.store.getState() as DeeplyReadonly<TState>, commitedEvent)) {
        this.store.saveSnapshot(commitedEvent.sequenceNumber).catch(console.error)
      }

      if (this.canceller.isCancelled()) return

      const correlationId = commitedEvent.correlationId || commitedEvent.eventId

      for (const event of eventsOut) {
        // Cycle detection check
        let pointer: string | undefined = commitedEvent.eventId
        const depthLimit = 100 // Hard limit just in case
        let jumps = 0
        while (pointer) {
          const node = this.causationGraph.get(pointer)
          if (!node) break

          if (jumps >= depthLimit) {
            console.error(`Ductus Framework Error: Maximum causation depth limit (${depthLimit}) reached at event '${event.type}'. Infinite recursive loop suspected. Halting propagation.`)
            this.canceller.cancel({ force: true })
            return
          }
          pointer = node.causationId
          jumps++
        }

        this.cascadingEvents.insertLast({
          event,
          context: {
            causationId: commitedEvent.eventId,
            correlationId,
          },
        })
      }

      const wakeUpCascade = this.cascadeWakeUpResolvers.removeFirst()
      wakeUpCascade?.()
    })
  }

  private async mountProcessor(processor: EventProcessor<TState>) {
    try {
      const subscriber = this.multiplexer.subscribe({
        name: processor.name ? `${processor.name}Subscriber` : null,
      })
      this.subscribers.push(subscriber)

      const process = (eventsIn: AsyncIterable<CommittedEvent>) => processor.process(
        eventsIn,
        this.getState,
        this.use,
      )

      await this.intentProcessor.process({
        eventsIn: subscriber.streamEvents(),
        processor: process,
        sourceSubscriber: subscriber,
        canceller: this.canceller,
      })
    } catch (e: any) {
      console.error(`Ductus Framework Error: Processor threw an unhandled exception. Initiating Kernel shutdown.`, e)
      this.shutdown({ force: true }).catch(err => console.error(`Ductus Framework Error during forced shutdown:`, err))
      throw e
    }
  }

  private async mountCascadingEvents() {
    try {
      while (!this.canceller.isCancelled()) {
        const wrapper = this.cascadingEvents.removeFirst()

        if (wrapper) {
          await this.multiplexer.broadcast(wrapper.event, wrapper.context)
        } else {
          if (this.isShuttingDown) break

          await new Promise<void>(resolve => {
            this.cascadeWakeUpResolvers.insertLast(resolve)
          })
        }
      }
    } catch (e: any) {
      console.error(`Ductus Framework Error: Cascading loop threw an unhandled exception. Initiating Kernel shutdown.`, e)
      this.shutdown({ force: true }).catch(err => console.error(`Ductus Framework Error during forced shutdown:`, err))
      throw e
    }
  }
}
