import { DistributionStrategy } from '../../../interfaces/coordination/distribution-strategy.js'
import { AsyncChannel } from '../../../interfaces/coordination/async-channel.js'
import { CommittedEvent } from '../../../interfaces/event.js'

/**
 * When to use:  Events are fully independent.
 * Spread the load optimally based on actual worker capacity.
 */
export class LeastBusyStrategy implements DistributionStrategy {
  select(workers: Array<AsyncChannel<CommittedEvent>>) {
    let minIndex = 0
    let minSize = workers[0].size()

    for (let i = 1; i < workers.length; i++) {
      if (workers[i].size() < minSize) {
        minSize = workers[i].size()
        minIndex = i
      }
    }

    return minIndex
  }
}
