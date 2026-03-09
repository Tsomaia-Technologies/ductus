import { LinkedList } from '../linked-list.js'
import { DefaultDeferrer } from '../default-deferrer.js'
import { AsyncChannel } from '../../interfaces/coordination/async-channel.js'

export class WorkerChannel<T> implements AsyncChannel<T> {
  private queue = new LinkedList<T>()
  private deferrer = new DefaultDeferrer()
  private closed = false

  size(): number {
    return this.queue.size
  }

  push(item: T): void {
    this.queue.insertLast(item)
    this.deferrer.wakeUpNext()
  }

  close(): void {
    this.closed = true
    this.deferrer.wakeUpAll()
  }

  isClosed(): boolean {
    return this.closed
  }

  async* stream(): AsyncIterable<T> {
    while (true) {
      const item = this.queue.removeFirst()
      if (item !== null) {
        yield item
      } else if (this.closed) {
        return
      } else {
        await this.deferrer.sleep()
      }
    }
  }
}
