import { CommitContext, EventSequencer } from '../interfaces/event-sequencer.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { DeeplyReadonly } from '../interfaces/helpers.js'
import { getEventHash, getInitialEventHash } from '../utils/crypto-utils.js'
import { freezeEvent } from '../utils/object.utils.js'
import { Mutex } from './mutex.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { DefaultEventListener } from './default-event-listener.js'

export interface DefaultEventSequencerOptions {
  ledger: EventLedger
  initialHash?: string
}

export class DefaultEventSequencer implements EventSequencer {
  private readonly ledger: EventLedger
  private readonly lockMutex = new Mutex()
  private readonly commitListener = new DefaultEventListener<CommittedEvent>()
  private lastHash: string
  private lastSequenceNumber = 0

  constructor(options: DefaultEventSequencerOptions) {
    this.ledger = options.ledger
    this.lastHash = options?.initialHash ?? getInitialEventHash()
  }

  async commit(event: BaseEvent, context?: CommitContext): Promise<CommittedEvent> {
    return await this.lockMutex.lock(async () => {
      const commitedEvent = this.commitEvent(event, context)

      if (this.ledger) {
        await this.ledger.appendEvent(commitedEvent as unknown as CommittedEvent)
      }

      this.lastSequenceNumber = commitedEvent.sequenceNumber
      this.lastHash = commitedEvent.hash
      this.commitListener.trigger(commitedEvent)

      return commitedEvent
    })
  }

  onCommit(callback: (event: CommittedEvent) => void): () => void {
    return this.commitListener.on(callback)
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
}
