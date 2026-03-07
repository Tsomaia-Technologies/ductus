import { BufferedSubscriber } from './buffered-subscriber.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { freezeEvent } from '../utils/object.utils.js'
import { getEventHash, getInitialEventHash } from '../utils/crypto-utils.js'
import { BroadcastingContext, Multiplexer } from '../interfaces/multiplexer.js'
import { DeeplyReadonly } from '../interfaces/helpers.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { Mutex } from './mutex.js'

export interface DuctusMultiplexerOptions {
  initialHash?: string
  initialSequenceNumber?: number
  ledger: EventLedger
  bufferLimit?: number
  bufferTimeoutMs?: number
  overflowStrategy?: 'fail' | 'block' | 'throttle'
  maxInFlightDelivery?: number
}

export class DuctusMultiplexer implements Multiplexer {
  private lastHash = getInitialEventHash()
  private lastSequenceNumber = 0
  private readonly bridges: BufferedSubscriber[] = []
  private readonly lockMutex = new Mutex()
  private commitListeners: Array<(event: CommittedEvent) => BaseEvent[] | void> = []
  private readonly ledger: EventLedger
  private initialSyncPromise: Promise<void>
  private iterationCount = 0
  private deliveryPromiseChain: Promise<any> = Promise.resolve()
  private readonly bufferLimit?: number
  private readonly bufferTimeoutMs?: number
  private readonly overflowStrategy: 'fail' | 'block' | 'throttle'
  private readonly maxInFlightDelivery: number
  private inFlightCount = 0

  constructor(options: DuctusMultiplexerOptions) {
    this.ledger = options.ledger
    this.bufferLimit = options.bufferLimit
    this.bufferTimeoutMs = options.bufferTimeoutMs
    this.overflowStrategy = options.overflowStrategy ?? 'fail'
    this.maxInFlightDelivery = options.maxInFlightDelivery ?? 100
    if (options.initialHash) this.lastHash = options.initialHash
    if (options.initialSequenceNumber) this.lastSequenceNumber = options.initialSequenceNumber

    // Pre-emptively hold the lock to sync with the ledger before first broadcast
    this.initialSyncPromise = this.lockMutex.lock(() => this.syncLedger()).catch(err => {
      console.error(`Ductus Framework Error during initial ledger sync:`, err)
      throw err // Re-throw so callers can catch it on broadcast
    })
  }

  subscribe(): BufferedSubscriber {
    const bridge = new BufferedSubscriber({
      bufferLimit: this.bufferLimit,
      bufferTimeoutMs: this.bufferTimeoutMs,
      overflowStrategy: this.overflowStrategy,
    })
    this.bridges.push(bridge)

    bridge.onUnsubscribe(() => {
      const index = this.bridges.indexOf(bridge)

      if (index > -1) {
        this.bridges.splice(index, 1)
      }
    })

    return bridge
  }

  onCommit(callback: (event: CommittedEvent) => void) {
    this.commitListeners.push(callback)

    return () => {
      this.commitListeners.splice(this.commitListeners.indexOf(callback), 1)
    }
  }

  async broadcast(
    event: BaseEvent,
    context?: BroadcastingContext,
  ): Promise<void> {
    await this.initialSyncPromise

    // Phase 1: COMMIT (under lock)
    const commitedEvent = await this.lockMutex.lock(async () => {
      const commited = this.commitEvent(event, context)
      if (this.ledger) {
        await this.ledger.appendEvent(commited as unknown as CommittedEvent)
      }

      this.lastSequenceNumber = commited.sequenceNumber
      this.lastHash = commited.hash

      this.commitListeners.forEach(listener => {
        listener(commited as unknown as CommittedEvent)
      })

      return commited as unknown as CommittedEvent
    })

    // Phase 2: DELIVERY (sequenced but outside lock)
    if (this.overflowStrategy === 'block') {
      // Deliver inline, fully await before returning to caller.
      // Producer is held here until every bridge has accepted the event.
      // No chain needed — sequential by nature since broadcast() itself is awaited.
      await this.invokeBridges(commitedEvent)
      return
    }

    this.inFlightCount++
    const currentDelivery = this.deliveryPromiseChain.then(async () => {
      try {
        await this.invokeBridges(commitedEvent)
      } finally {
        this.inFlightCount--
        if (this.inFlightCount === 0) {
          this.deliveryPromiseChain = Promise.resolve()
        }
      }
    })
    this.deliveryPromiseChain = currentDelivery

    // If we're below the grace threshold, return immediately to allow for recursive/local cycles.
    // Otherwise, wait for the delivery to catch up (backpressure).
    if (this.overflowStrategy === 'fail' && this.inFlightCount < this.maxInFlightDelivery) {
      return Promise.resolve()
    }

    return await currentDelivery
  }

  private async syncLedger() {
    if (!this.ledger) return
    const lastEvent = await this.ledger.readLastEvent()
    if (lastEvent) {
      this.lastSequenceNumber = lastEvent.sequenceNumber
      this.lastHash = lastEvent.hash
    }
  }

  private commitEvent(event: BaseEvent, context?: {
    causationId?: string,
    correlationId?: string,
    chainId?: string
  }): DeeplyReadonly<CommittedEvent> {
    const nextSequenceNumber = this.lastSequenceNumber + 1
    const eventId = crypto.randomUUID()
    const timestamp = Date.now()
    const unhashedEvent: Omit<CommittedEvent, 'hash'> = {
      ...event,
      eventId,
      ...(context?.chainId ? { chainId: context.chainId } : {}),
      ...(context?.causationId ? { causationId: context.causationId } : {}),
      ...(context?.correlationId ? { correlationId: context.correlationId } : {}),
      sequenceNumber: nextSequenceNumber,
      prevHash: this.lastHash,
      isCommited: true,
      timestamp,
    } as Omit<CommittedEvent, 'hash'>

    const hash = getEventHash(unhashedEvent)
    const commitedEvent = {
      ...unhashedEvent,
      hash,
    } as CommittedEvent

    return freezeEvent(commitedEvent)
  }

  private async invokeBridges(event: CommittedEvent) {
    await Promise.all(this.bridges.map(bridge => bridge.push(event)))
  }
}
