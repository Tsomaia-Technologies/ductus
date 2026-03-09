import { ScalingPolicy } from '../../../interfaces/coordination/scaling-policy.js'
import { ClusterMetrics } from '../../../interfaces/coordination/cluster-metrics.js'

export interface QueueDepthScalingPolicyOptions {
  checkIntervalMs?: number
  cooldownMs?: number
}

export class QueueDepthScalingPolicy implements ScalingPolicy {
  readonly checkIntervalMs: number
  readonly cooldownMs: number

  constructor(options?: QueueDepthScalingPolicyOptions) {
    this.checkIntervalMs = options?.checkIntervalMs ?? 1000
    this.cooldownMs = options?.cooldownMs ?? 3000
  }

  shouldScaleUp(metrics: ClusterMetrics): boolean {
    // Everyone has work and there's still backlog — need more hands
    return metrics.idleWorkers === 0 && metrics.totalQueueDepth > 0
  }

  shouldScaleDown(metrics: ClusterMetrics): boolean {
    // More than one worker sitting idle — can afford to shed one
    return metrics.idleWorkers > 1
  }
}
