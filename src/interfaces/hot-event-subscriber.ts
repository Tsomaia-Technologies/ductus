import { CommittedEvent } from './event.js'
import { EventSubscriber } from './event-subscriber.js'
import { Disposer } from './cancellation-token.js'

export interface HotEventSubscriber extends EventSubscriber {
  enqueue(event: CommittedEvent): void

  isConsuming(): boolean

  setConsuming(consuming: boolean): void

  waitForDrain(): Promise<void>

  onDrain(callback: () => void): Disposer
}
