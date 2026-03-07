import { CommittedEvent } from './event.js'
import { EventSubscriber } from './event-subscriber.js'

export interface HotEventSubscriber extends EventSubscriber {
  push(event: CommittedEvent): Promise<void>
}
