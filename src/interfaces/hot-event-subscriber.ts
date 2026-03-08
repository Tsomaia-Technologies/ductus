import { CommittedEvent } from './event.js'
import { EventSubscriber } from './event-subscriber.js'
import { Disposer } from './cancellation-token.js'

export interface HotEventSubscriber extends EventSubscriber {
  push(event: CommittedEvent): Promise<void>

  isFull(): boolean

  onDrain(callback: () => void): Disposer
}
