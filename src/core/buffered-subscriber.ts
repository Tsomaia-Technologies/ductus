import { LinkedList } from './linked-list.js'
import { CommittedEvent } from '../interfaces/event.js'
import { HotEventSubscriber } from '../interfaces/hot-event-subscriber.js'

export interface BufferedSubscriberOptions {
  name?: string | null
  bufferLimit?: number
  bufferTimeoutMs?: number
  overflowStrategy?: 'fail' | 'block' | 'throttle'
}

export class BufferedSubscriber implements HotEventSubscriber {
  private readonly eventQueue = new LinkedList<CommittedEvent>()
  private readonly drainListeners = new LinkedList<() => void>()
  private readonly processorWakeUpQueue = new LinkedList<() => void>()
  private readonly terminationListeners: Array<() => void> = []
  private isTerminated = false
  private readonly _name: string | null
  private readonly bufferLimit: number
  private readonly bufferTimeoutMs: number
  private readonly overflowStrategy: 'fail' | 'block' | 'throttle'
  private readonly bufferDrainWakeUpQueue = new LinkedList<{
    resolve: () => void,
    reject: (err: Error) => void,
    timer: NodeJS.Timeout
  }>()

  constructor(options?: BufferedSubscriberOptions) {
    this._name = options?.name ?? null
    this.bufferLimit = options?.bufferLimit ?? 10000
    this.bufferTimeoutMs = options?.bufferTimeoutMs ?? 5000
    this.overflowStrategy = options?.overflowStrategy ?? 'fail'
  }

  name(): string | null {
    return this._name;
  }

  async push(event: CommittedEvent): Promise<void> {
    console.log(`[PUSH] type=${event.type} queueSize=${this.eventQueue.size} limit=${this.bufferLimit}`)

    if (this.isTerminated) {
      return
    }

    if (this.eventQueue.size >= this.bufferLimit) {
      console.log(`[PUSH] SUSPENDING — buffer full for type=${event.type}`)

      if (this.overflowStrategy === 'fail') {
        throw new Error(`Fatal: Subscriber buffer overflow. Limit of ${this.bufferLimit} events reached. Consumer is too slow or deadlocked.`)
      }

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.isTerminated = true
          reject(new Error(`Fatal: Subscriber buffer overflow. Limit of ${this.bufferLimit} events reached and timeout of ${this.bufferTimeoutMs}ms exceeded.`))
        }, this.bufferTimeoutMs)

        this.bufferDrainWakeUpQueue.insertLast({ resolve, reject, timer })
      })
      console.log(`[PUSH] RESUMED after drain for type=${event.type}`)
    }

    this.eventQueue.insertLast(event)

    const wakeUp = this.processorWakeUpQueue.removeFirst()
    wakeUp?.()

    return Promise.resolve()
  }

  async* streamEvents(): AsyncIterable<CommittedEvent> {
    while (true) {
      const event = this.eventQueue.removeFirst()

      // Wake up a blocked producer if queue space freed up
      const bufferWaiter = this.bufferDrainWakeUpQueue.removeFirst()
      if (bufferWaiter) {
        console.log(`[STREAM] waking drain waiter, queueSize after remove=${this.eventQueue.size}`)
        clearTimeout(bufferWaiter.timer)
        bufferWaiter.resolve()
      }

      if (event) {
        this.triggerDrainListeners()
        yield event
      } else {
        if (this.isTerminated) return

        await new Promise<void>(resolve => {
          this.processorWakeUpQueue.insertLast(resolve)
        })
      }
    }
  }

  isFull() {
    return this.eventQueue.size >= this.bufferLimit
  }

  onDrain(callback: () => void) {
    const token = this.drainListeners.insertLast(callback)

    return () => {
      this.drainListeners.removeByToken(token)
    }
  }

  unsubscribe({ drain = true }: { drain?: boolean } = {}): CommittedEvent[] {
    let wakeUp: (() => void) | null = null

    this.isTerminated = true

    while (wakeUp = this.processorWakeUpQueue.removeFirst()) {
      wakeUp()
    }

    let bufferWaiter: any
    while (bufferWaiter = this.bufferDrainWakeUpQueue.removeFirst()) {
      clearTimeout(bufferWaiter.timer)
      bufferWaiter.resolve() // Unblock any pending producers immediately since we're terminating anyway
    }

    let discardedEvents: CommittedEvent[] = []

    if (!drain) {
      discardedEvents = this.eventQueue.toArray()
      this.eventQueue.clear()
    }

    this.terminationListeners.forEach(listener => listener())

    return discardedEvents
  }

  onUnsubscribe(callback: () => void) {
    this.terminationListeners.push(callback)
  }

  private triggerDrainListeners() {
    let current: (() => void) | null = null

    while (current = this.drainListeners.removeFirst()) {
      current()
    }
  }
}
