import { BufferedSubscriber } from './buffered-subscriber.js'
import { DuctusEvent } from '../events/types.js'
import { CommittedEvent } from '../interfaces/event.js'
import { freezeEvent } from '../utils/object.utils.js'
import { getEventHash, getInitialEventHash } from '../utils/crypto-utils.js'
import { Multiplexer } from '../interfaces/multiplexer.js'

export class DuctusMultiplexer implements Multiplexer<DuctusEvent, CommittedEvent> {
  private lastHash = getInitialEventHash()
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

    bridge.onUnsubscribe(() => {
      const index = this.bridges.indexOf(bridge)

      if (index > -1) {
        this.bridges.splice(index, 1)
      }
    })

    return bridge
  }

  async broadcast(event: DuctusEvent): Promise<void> {
    return await this.lock(async () => {
      const commitedEvent = this.commitEvent(event)
      await this.invokeBridges(commitedEvent)
    })
  }

  async replay(event: CommittedEvent): Promise<void> {
    return await this.lock(async () => {
      const replayEvent = Object.freeze({
        ...event,
        isReplay: true,
      })

      await this.invokeBridges(replayEvent)
    })
  }

  private lock(callback: () => void | Promise<void>): Promise<void> {
    const turn = this.broadcastLock.then(callback)
    this.broadcastLock = turn

    return turn
  }

  private commitEvent(event: DuctusEvent): CommittedEvent {
    ++this.lastSequenceNumber
    const eventId = crypto.randomUUID()
    const hash = getEventHash({
      ...event,
      eventId,
      sequenceNumber: this.lastSequenceNumber,
      prevHash: this.lastHash,
      isCommited: true,
    })
    const commitedEvent: CommittedEvent = {
      ...event,
      eventId,
      sequenceNumber: this.lastSequenceNumber,
      prevHash: this.lastHash,
      isCommited: true,
      isReplay: false,
      hash,
    }
    this.lastHash = hash

    return freezeEvent(commitedEvent)
  }

  private async invokeBridges(event: CommittedEvent) {
    await Promise.all(this.bridges.map(bridge => bridge.push(event)))
  }
}
