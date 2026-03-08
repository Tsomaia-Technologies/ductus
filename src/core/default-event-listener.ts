import { LinkedList } from './linked-list.js'
import { EventCallback, EventListener } from '../interfaces/event-listener.js'
import { CancellationToken } from '../interfaces/cancellation-token.js'

export class DefaultEventListener<TEvent = void> implements EventListener<TEvent> {
  private callbacks = new LinkedList<EventCallback<TEvent>>()
  private onceCallbacks = new LinkedList<EventCallback<TEvent>>()

  on(callback: EventCallback<TEvent>): () => void {
    const token = this.callbacks.insertLast(callback)

    return () => this.callbacks.removeByToken(token)
  }

  once(callback: EventCallback<TEvent>): () => void {
    const token = this.onceCallbacks.insertLast(callback)

    return () => this.onceCallbacks.removeByToken(token)
  }

  wait(canceller?: CancellationToken): Promise<TEvent> {
    return new Promise<TEvent>((resolve) => {
      const cancel = this.once(resolve)
      canceller?.onCancel(cancel)
    })
  }

  trigger(event: TEvent) {
    let current: EventCallback<TEvent> | null = null

    while (current = this.onceCallbacks.removeFirst()) {
      current(event)
    }

    for (const callback of this.callbacks) {
      callback(event)
    }
  }
}
