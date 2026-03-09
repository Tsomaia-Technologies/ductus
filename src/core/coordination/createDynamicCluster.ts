import { EventGenerator } from '../../interfaces/event-generator.js'
import { BaseEvent, CommittedEvent } from '../../interfaces/event.js'
import { WorkerChannel } from './worker-channel.js'
import { ClusterMetrics } from '../../interfaces/coordination/cluster-metrics.js'
import { forward } from './forward.js'
import { DistributionStrategy } from '../../interfaces/coordination/distribution-strategy.js'
import { ScalingPolicy } from '../../interfaces/coordination/scaling-policy.js'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface DynamicClusterOptions<TState> {
  min: number
  max: number
  strategy: DistributionStrategy
  scaling: ScalingPolicy
  processor: EventGenerator<TState>
}

export function createDynamicCluster<TState>(
  options: DynamicClusterOptions<TState>,
): EventGenerator<TState> {
  const { min, max, strategy, scaling, processor } = options

  return async function* (events, getState, use) {
    const workerInputs: WorkerChannel<CommittedEvent>[] = []
    const output = new WorkerChannel<BaseEvent | undefined>()

    let activeWorkers = 0
    let firstError: unknown = null
    let distributionEnded = false

    const onWorkerDone = () => {
      activeWorkers--
      if (activeWorkers === 0 && distributionEnded) output.close()
    }

    const onWorkerError = (err: unknown) => {
      if (!firstError) firstError = err

      for (let i = 0; i < workerInputs.length; i++) {
        const input = workerInputs[i]
        input.close()
      }

      output.close()
    }

    const addWorker = () => {
      if (workerInputs.length >= max) return
      const input = new WorkerChannel<CommittedEvent>()
      workerInputs.push(input)
      activeWorkers++
      forward(processor(input.stream(), getState, use), output)
        .catch(onWorkerError)
        .finally(onWorkerDone)
    }

    const removeIdleWorker = () => {
      if (workerInputs.length <= min) return
      const idleIndex = workerInputs.findIndex(ch => ch.size() === 0)
      if (idleIndex === -1) return
      const [removed] = workerInputs.splice(idleIndex, 1)
      removed.close()
    }

    const collectMetrics = (): ClusterMetrics => {
      const busyWorkers = workerInputs.filter(ch => ch.size() > 0).length

      return {
        workerCount: workerInputs.length,
        busyWorkers,
        idleWorkers: workerInputs.length - busyWorkers,
        totalQueueDepth: workerInputs.reduce((sum, ch) => sum + ch.size(), 0),
        maxQueueDepth: workerInputs.reduce((m, ch) => Math.max(m, ch.size()), 0),
      }
    }

    for (let i = 0; i < min; i++) {
      addWorker()
    }

    const distributor = (async () => {
      for await (const event of events) {
        if (output.isClosed()) break
        const targetIndex = strategy.select(workerInputs, event)
        workerInputs[targetIndex].push(event)
      }

      distributionEnded = true

      for (let i = 0; i < workerInputs.length; i++) {
        const input = workerInputs[i]
        input.close()
      }

      if (activeWorkers === 0) output.close()
    })()

    const monitor = (async () => {
      let lastScaleTime = 0

      while (!output.isClosed() && !distributionEnded) {
        await sleep(scaling.checkIntervalMs)
        if (output.isClosed() || distributionEnded) break

        const now = Date.now()
        if (now - lastScaleTime < (scaling.cooldownMs ?? 0)) continue

        const metrics = collectMetrics()

        if (workerInputs.length < max && scaling.shouldScaleUp(metrics)) {
          addWorker()
          lastScaleTime = now
        } else if (workerInputs.length > min && scaling.shouldScaleDown(metrics)) {
          removeIdleWorker()
          lastScaleTime = now
        }
      }
    })()

    for await (const event of output.stream()) {
      yield event
    }

    await Promise.allSettled([distributor, monitor])

    if (firstError) throw firstError
  }
}
