import { EventGenerator } from '../event-generator.js'
import { DistributionStrategy } from '../coordination/distribution-strategy.js'
import { ProcessorBuilder } from './processor-builder.js'

export interface FixedClusterBuilder<TState> extends ProcessorBuilder<TState> {
  name(name: string): this
  size(size: number): this
  strategy(strategy: DistributionStrategy): this
  processor(generator: EventGenerator<TState> | ProcessorBuilder<TState>): this
}
