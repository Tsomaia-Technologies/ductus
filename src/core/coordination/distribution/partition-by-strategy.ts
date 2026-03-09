import { DistributionStrategy } from '../../../interfaces/coordination/distribution-strategy.js'
import { CommittedEvent } from '../../../interfaces/event.js'
import { AsyncChannel } from '../../../interfaces/coordination/async-channel.js'
import { djb2Hash } from '../../../utils/crypto-utils.js'

/**
 * Routes all events with the same key to the same worker. Always.
 *
 * When to use: Events are independent across keys but dependent within a key.
 * Same-key ordering must be preserved.
 */
export class PartitionByStrategy implements DistributionStrategy {
  constructor(private readonly key: (event: CommittedEvent) => string) {
  }

  select(workers: AsyncChannel<CommittedEvent>[], event: CommittedEvent): number {
    return djb2Hash(this.key(event)) % workers.length
  }
}
