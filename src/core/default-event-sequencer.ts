import { CommitContext, CommitEventData, EventSequencer } from '../interfaces/event-sequencer.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { DeeplyReadonly } from '../interfaces/helpers.js'
import { getEventHash, getInitialEventHash } from '../utils/crypto-utils.js'
import { freezeEvent } from '../utils/object.utils.js'
import { Mutex } from './mutex.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { DefaultEventListener } from './default-event-listener.js'

export class DefaultEventSequencer implements EventSequencer {
  private readonly lockMutex = new Mutex()
  private readonly commitListener = new DefaultEventListener<CommitEventData>()
  private lastDurableHash: string = getInitialEventHash()
  private lastSequenceNumber = 0
  private isHydrated = false

  constructor(private readonly ledger: EventLedger) {
  }

  async commit(event: BaseEvent, context?: CommitContext): Promise<CommittedEvent> {
    return await this.lockMutex.lock(async () => {
      await this.ensureHydrated()

      const commitedEvent = this.commitEvent(event, context)
      const isVolatile = event.volatility === 'volatile'

      if (!isVolatile && this.ledger) {
        await this.ledger.appendEvent(commitedEvent)
      }

      this.lastSequenceNumber = commitedEvent.sequenceNumber

      if (!isVolatile) {
        this.lastDurableHash = commitedEvent.hash
      }

      this.commitListener.trigger({
        event: commitedEvent,
        sourceSubscriber: context?.sourceSubscriber,
      })

      return commitedEvent
    })
  }

  onCommit(callback: (event: CommitEventData) => void): () => void {
    return this.commitListener.on(callback)
  }

  private async ensureHydrated() {
    if (this.isHydrated) return
    const lastEvent = await this.ledger.readLastEvent()

    if (lastEvent) {
      this.lastDurableHash = lastEvent.hash
      this.lastSequenceNumber = lastEvent.sequenceNumber
    }

    this.isHydrated = true
  }

  private commitEvent(event: BaseEvent, context?: CommitContext): DeeplyReadonly<CommittedEvent> {
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
      prevHash: this.lastDurableHash,
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
}
