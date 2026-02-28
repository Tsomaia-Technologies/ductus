import { BufferedSubscriber } from './buffered-subscriber.js'
import { DuctusEvent } from '../events/types.js'
import { CommittedEvent } from '../interfaces/event.js'
import { freezeEvent } from '../utils/object.utils.js'
import { sha256 } from '../utils/crypto-utils.js'
import { Multiplexer } from '../interfaces/multiplexer.js'

export class DuctusMultiplexer implements Multiplexer<DuctusEvent, CommittedEvent> {
  private lastHash = '0'.repeat(64)
  private lastSequenceNumber = 0
  private readonly bridges: BufferedSubscriber[] = []
  private broadcastLock = Promise.resolve()

  constructor(initialHash?: string, initialSequenceNumber?: number) {
    if (initialHash) this.lastHash = initialHash
    if (initialSequenceNumber) this.lastSequenceNumber = initialSequenceNumber
  }

  subscribe(): BufferedSubscriber {
    const bridge = new BufferedSubscriber()
    this.bridges.push(bridge)

    return bridge
  }

  broadcast(event: DuctusEvent): Promise<void> {
    const turn = this.broadcastLock.then(async () => {
      const commitedEvent = this.commitEvent(event)
      await this.invokeBridges(commitedEvent)
    })
    this.broadcastLock = turn

    return turn
  }

  async replay(event: CommittedEvent): Promise<void> {
    const replayEvent = Object.freeze({
      ...event,
      isReplay: true,
    })

    await this.invokeBridges(replayEvent)
  }

  private commitEvent(event: DuctusEvent): CommittedEvent {
    ++this.lastSequenceNumber
    const eventId = crypto.randomUUID()
    const hashPayload = JSON.stringify({
      type: event.type,
      payload: event.payload,
      authorId: event.authorId,
      timestamp: event.timestamp,
      volatility: event.volatility,

      eventId,
      sequenceNumber: this.lastSequenceNumber,
      prevHash: this.lastHash,
      isCommited: true,
    })

    const hash = sha256(hashPayload)
    const commitedEvent: CommittedEvent = {
      ...event,
      eventId,
      sequenceNumber: this.lastSequenceNumber,
      prevHash: this.lastHash,
      isReplay: false,
      isCommited: true,
      hash,
    }
    this.lastHash = hash

    return freezeEvent(commitedEvent)
  }

  private async invokeBridges(event: CommittedEvent) {
    await Promise.all(this.bridges.map(bridge => bridge.push(event)))
  }
}
