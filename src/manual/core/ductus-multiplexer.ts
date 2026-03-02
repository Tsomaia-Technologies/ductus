import { BufferedSubscriber } from './buffered-subscriber.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { freezeEvent } from '../utils/object.utils.js'
import { getEventHash, getInitialEventHash } from '../utils/crypto-utils.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { DeeplyReadonly } from '../interfaces/helpers.js'

export class DuctusMultiplexer<TEvent extends BaseEvent> implements Multiplexer<TEvent> {
  private lastHash = getInitialEventHash()
  private lastSequenceNumber = 0
  private readonly bridges: BufferedSubscriber<CommittedEvent<TEvent>>[] = []
  private broadcastLock = Promise.resolve<unknown>(null)
  private commitListeners: Array<(event: CommittedEvent<TEvent>) => TEvent[] | void> = []

  constructor(initialHash?: string, initialSequenceNumber?: number) {
    if (initialHash) this.lastHash = initialHash
    if (initialSequenceNumber) this.lastSequenceNumber = initialSequenceNumber
  }

  subscribe(): BufferedSubscriber<CommittedEvent<TEvent>> {
    const bridge = new BufferedSubscriber<CommittedEvent<TEvent>>()
    this.bridges.push(bridge)

    bridge.onUnsubscribe(() => {
      const index = this.bridges.indexOf(bridge)

      if (index > -1) {
        this.bridges.splice(index, 1)
      }
    })

    return bridge
  }

  onCommit(callback: (event: CommittedEvent<TEvent>) => void) {
    this.commitListeners.push(callback)

    return () => {
      this.commitListeners.splice(this.commitListeners.indexOf(callback), 1)
    }
  }

  async broadcast(event: TEvent): Promise<void> {
    return await this.lock(async () => {
      const commitedEvent = this.commitEvent(event)
      this.commitListeners.forEach(listener => {
        listener(commitedEvent as unknown as CommittedEvent<TEvent>)
      })
      await this.invokeBridges(commitedEvent as unknown as CommittedEvent<TEvent>)
    })
  }

  private lock<T>(callback: () => T | Promise<T>): Promise<T> {
    const turn = this.broadcastLock.then(callback)
    this.broadcastLock = turn

    return turn
  }

  private commitEvent(event: TEvent): DeeplyReadonly<CommittedEvent<TEvent>> {
    ++this.lastSequenceNumber
    const eventId = crypto.randomUUID()
    const timestamp = Date.now()
    const unhashedEvent: Omit<CommittedEvent<TEvent>, 'hash'> = {
      ...event,
      eventId,
      sequenceNumber: this.lastSequenceNumber,
      prevHash: this.lastHash,
      isCommited: true,
      timestamp,
    } as Omit<CommittedEvent<TEvent>, 'hash'>

    const hash = getEventHash(unhashedEvent)
    const commitedEvent = {
      ...unhashedEvent,
      hash,
    } as CommittedEvent<TEvent>
    this.lastHash = hash

    return freezeEvent(commitedEvent)
  }

  private async invokeBridges(event: CommittedEvent<TEvent>) {
    await Promise.all(this.bridges.map(bridge => bridge.push(event)))
  }
}
