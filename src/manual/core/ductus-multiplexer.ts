import { BufferedSubscriber } from './buffered-subscriber.js'
import { DuctusEvent } from '../events/types.js'
import { CommittedEvent } from '../interfaces/event.js'
import { freezeEvent } from '../utils/object.utils.js'
import { getEventHash, getInitialEventHash } from '../utils/crypto-utils.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { LinkedList } from './linked-list.js'

export class DuctusMultiplexer implements Multiplexer<DuctusEvent, CommittedEvent> {
  private lastHash = getInitialEventHash()
  private lastSequenceNumber = 0
  private readonly bridges: BufferedSubscriber[] = []
  private broadcastLock = Promise.resolve()
  private commitListeners: Array<(event: CommittedEvent) => DuctusEvent[] | void> = []

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

  onCommit(callback: (event: CommittedEvent) => void) {
    this.commitListeners.push(callback)

    return () => {
      this.commitListeners.splice(this.commitListeners.indexOf(callback), 1)
    }
  }

  async broadcast(event: DuctusEvent): Promise<void> {
    return await this.lock(async () => {
      const eventQueue = new LinkedList<DuctusEvent>()
      eventQueue.insertLast(event)

      let currentDraft: DuctusEvent | null = null

      while (currentDraft = eventQueue.removeFirst()) {
        const commitedEvent = this.commitEvent(currentDraft)

        for (const listener of this.commitListeners) {
          const cascades = listener(commitedEvent)

          if (Array.isArray(cascades) && cascades.length > 0) {
            for (const cascadedEvent of cascades) {
              eventQueue.insertLast(cascadedEvent)
            }
          }
        }

        await this.invokeBridges(commitedEvent)
      }
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
    const unhashedEvent: Omit<CommittedEvent, 'hash'> = {
      ...event,
      eventId,
      sequenceNumber: this.lastSequenceNumber,
      prevHash: this.lastHash,
      isCommited: true,
    }

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
