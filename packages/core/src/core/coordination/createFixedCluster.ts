import { EventGenerator } from '../../interfaces/event-generator.js'
import { BaseEvent, CommittedEvent } from '../../interfaces/event.js'
import { WorkerChannel } from './worker-channel.js'
import { DistributionStrategy } from '../../interfaces/coordination/distribution-strategy.js'
import { forward } from './forward.js'

export interface FixedClusterOptions<TState> {
  size: number
  strategy: DistributionStrategy
  processor: EventGenerator<TState>
}

export function createFixedCluster<TState>(
  options: FixedClusterOptions<TState>,
): EventGenerator<TState> {
  const { processor, size, strategy } = options

  return async function* (events, getState, use) {
    const workerInputs = Array.from(
      { length: size },
      () => new WorkerChannel<CommittedEvent>(),
    )
    const output = new WorkerChannel<BaseEvent | undefined>()

    let activeWorkers = size
    let firstError: unknown = null

    const onWorkerDone = () => {
      activeWorkers--
      if (activeWorkers === 0) output.close()
    }
    const onWorkerError = (err: unknown) => {
      if (!firstError) firstError = err

      for (let i = 0; i < workerInputs.length; i++) {
        const input = workerInputs[i]
        input.close()
      }

      output.close()
    }

    const workerTasks = workerInputs.map((input) =>
      forward(processor(input.stream(), getState, use), output)
        .catch(onWorkerError)
        .finally(onWorkerDone),
    )

    const distributor = (async () => {
      for await (const event of events) {
        if (output.isClosed()) break
        const targetIndex = strategy.select(workerInputs, event)
        workerInputs[targetIndex].push(event)
      }

      for (const input of workerInputs) {
        input.close()
      }
    })()

    for await (const event of output.stream()) {
      yield event
    }

    await Promise.allSettled([distributor, ...workerTasks])

    if (firstError) {
      throw firstError
    }
  }
}
