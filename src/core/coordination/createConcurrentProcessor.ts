// src/core/coordination/createConcurrentProcessor.ts

import { EventGenerator } from '../../interfaces/event-generator.js'
import { BaseEvent, CommittedEvent } from '../../interfaces/event.js'
import { WorkerChannel } from './worker-channel.js'
import { Semaphore } from '../semaphore.js'

export interface ConcurrentHandlerContext<TState> {
  event: CommittedEvent,
  emit: (event: BaseEvent) => void
  getState: () => TState
  use: <T>(token: string) => T
}

export interface ConcurrentProcessorOptions<TState> {
  filter: (event: CommittedEvent) => boolean
  handle: (
    context: ConcurrentHandlerContext<TState>,
  ) => Promise<void>
  maxConcurrency: number
}

export function createConcurrentProcessor<TState>(
  options: ConcurrentProcessorOptions<TState>,
): EventGenerator<TState> {
  const { filter, handle, maxConcurrency } = options

  return async function* (events, getState, use) {
    const output = new WorkerChannel<BaseEvent>()
    const semaphore = new Semaphore(maxConcurrency)
    const tasks: Promise<void>[] = []

    let activeTasks = 0
    let inputDone = false
    let firstError: unknown = null

    const tryClose = () => {
      if (inputDone && activeTasks === 0) output.close()
    }

    const dispatcher = (async () => {
      for await (const event of events) {
        if (output.isClosed()) break
        if (!filter(event)) continue

        await semaphore.acquire()
        if (output.isClosed()) {
          semaphore.release()
          break
        }

        activeTasks++

        const task = (async () => {
          try {
            const emit = (e: BaseEvent) => {
              if (!output.isClosed()) output.push(e)
            }
            await handle({ event, emit, getState, use })
          } catch (err) {
            if (!firstError) firstError = err
            output.close()
          } finally {
            activeTasks--
            semaphore.release()
            tryClose()
          }
        })()

        tasks.push(task)
      }

      inputDone = true
      tryClose()
    })()

    for await (const event of output.stream()) {
      yield event
    }

    await Promise.allSettled([dispatcher, ...tasks])

    if (firstError) throw firstError
  }
}
