import { ScalingPolicy } from '../../../interfaces/coordination/scaling-policy.js'
import { ClusterMetrics } from '../../../interfaces/coordination/cluster-metrics.js'

export interface UtilizationScalingPolicyOptions {
  checkIntervalMs?: number
  cooldownMs?: number
  scaleUpThreshold?: number
  scaleDownThreshold?: number
}

export class UtilizationScalingPolicy implements ScalingPolicy {
  readonly checkIntervalMs: number
  readonly cooldownMs: number
  private readonly scaleUpThreshold: number
  private readonly scaleDownThreshold: number

  constructor(options?: UtilizationScalingPolicyOptions) {
    this.checkIntervalMs = options?.checkIntervalMs ?? 1000
    this.cooldownMs = options?.cooldownMs ?? 5000
    this.scaleUpThreshold = options?.scaleUpThreshold ?? 0.8
    this.scaleDownThreshold = options?.scaleDownThreshold ?? 0.2
  }

  shouldScaleUp(metrics: ClusterMetrics): boolean {
    return metrics.busyWorkers / metrics.workerCount > this.scaleUpThreshold
  }

  shouldScaleDown(metrics: ClusterMetrics): boolean {
    return metrics.busyWorkers / metrics.workerCount < this.scaleDownThreshold
  }
}
