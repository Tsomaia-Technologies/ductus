export interface ClusterMetrics {
  workerCount: number
  busyWorkers: number       // workers with non-empty input queue
  idleWorkers: number       // workers with empty input queue
  totalQueueDepth: number   // sum of all worker queue sizes
  maxQueueDepth: number     // single highest worker queue
}
