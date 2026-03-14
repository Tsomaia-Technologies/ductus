import { DistributionStrategy } from '../../../interfaces/coordination/distribution-strategy.js'
import { AsyncChannel } from '../../../interfaces/coordination/async-channel.js'
import { CommittedEvent } from '../../../interfaces/event.js'

/**
 * When to use: Events are fully independent.
 * No ordering requirement. Just spread the load.
 */
export class RoundRobinStrategy implements DistributionStrategy {
  private counter = 0

  select(workers: Array<AsyncChannel<CommittedEvent>>) {
    const index = this.counter % workers.length
    this.counter++

    return index
  }
}

