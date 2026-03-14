import { AsyncChannel } from './async-channel.js'
import { CommittedEvent } from '../event.js'

export interface DistributionStrategy {
  select(
    workers: Array<AsyncChannel<CommittedEvent>>,
    event: CommittedEvent,
  ): number
}
