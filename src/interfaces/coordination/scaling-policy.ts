import { ClusterMetrics } from './cluster-metrics.js'

export interface ScalingPolicy {
  checkIntervalMs: number
  cooldownMs?: number
  shouldScaleUp(metrics: ClusterMetrics): boolean
  shouldScaleDown(metrics: ClusterMetrics): boolean
}
