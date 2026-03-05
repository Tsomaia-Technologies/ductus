import { BufferedSubscriber } from './buffered-subscriber.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { freezeEvent } from '../utils/object.utils.js'
import { getEventHash, getInitialEventHash } from '../utils/crypto-utils.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { DeeplyReadonly } from '../interfaces/helpers.js'
import { EventLedger } from '../interfaces/event-ledger.js'

export interface DuctusMultiplexerOptions {
  initialHash?: string
  initialSequenceNumber?: number
  ledger: EventLedger
}

export class DuctusMultiplexer implements Multiplexer {
  private lastHash = getInitialEventHash()
  private lastSequenceNumber = 0
  private readonly bridges: BufferedSubscriber[] = []
  private broadcastLock: Promise<unknown>
  private commitListeners: Array<(event: CommittedEvent) => BaseEvent[] | void> = []
  private readonly ledger: EventLedger

  constructor(options: DuctusMultiplexerOptions) {
    this.ledger = options.ledger
    if (options.initialHash) this.lastHash = options.initialHash
    if (options.initialSequenceNumber) this.lastSequenceNumber = options.initialSequenceNumber

    // Pre-emptively hold the lock to sync with the ledger before first broadcast
    this.broadcastLock = this.syncLedger()
  }

  subscribe(): BufferedSubscriber {
    const bridge = new BufferedSubscriber()
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

  async broadcast(event: BaseEvent, context?: { causationId?: string, correlationId?: string }): Promise<void> {
    return await this.lock(async () => {
      const commitedEvent = this.commitEvent(event, context)
      if (this.ledger) {
        await this.ledger.appendEvent(commitedEvent as unknown as CommittedEvent)
      }
      this.commitListeners.forEach(listener => {
        listener(commitedEvent as unknown as CommittedEvent)
      })
      await this.invokeBridges(commitedEvent as unknown as CommittedEvent)
    })
  }

  private async syncLedger() {
    if (!this.ledger) return
    const lastEvent = await this.ledger.readLastEvent()
    if (lastEvent) {
      this.lastSequenceNumber = lastEvent.sequenceNumber
      this.lastHash = lastEvent.hash
    }
  }

  private lock<T>(callback: () => T | Promise<T>): Promise<T> {
    const turn = this.broadcastLock.then(callback)
    this.broadcastLock = turn

    return turn
  }

  private commitEvent(event: BaseEvent, context?: {
    causationId?: string,
    correlationId?: string
  }): DeeplyReadonly<CommittedEvent> {
    ++this.lastSequenceNumber
    const eventId = crypto.randomUUID()
    const timestamp = Date.now()
    const unhashedEvent: Omit<CommittedEvent, 'hash'> = {
      ...event,
      eventId,
      ...(context?.causationId ? { causationId: context.causationId } : {}),
      ...(context?.correlationId ? { correlationId: context.correlationId } : {}),
      sequenceNumber: this.lastSequenceNumber,
      prevHash: this.lastHash,
      isCommited: true,
      timestamp,
    } as Omit<CommittedEvent, 'hash'>

    const hash = getEventHash(unhashedEvent)
    const commitedEvent = {
      ...unhashedEvent,
      hash,
    } as CommittedEvent
    this.lastHash = hash

    return freezeEvent(commitedEvent)
  }

  private async invokeBridges(event: CommittedEvent) {
    await Promise.all(this.bridges.map(bridge => bridge.push(event)))
  }
}
