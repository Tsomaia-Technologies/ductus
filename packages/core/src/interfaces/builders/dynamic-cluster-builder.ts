import { EventGenerator } from '../event-generator.js'
import { DistributionStrategy } from '../coordination/distribution-strategy.js'
import { ScalingPolicy } from '../coordination/scaling-policy.js'
import { ProcessorBuilder } from './processor-builder.js'

export interface DynamicClusterBuilder<TState> extends ProcessorBuilder<TState> {
  name(name: string | null): this
  min(value: number): this
  max(value: number): this
  strategy(strategy: DistributionStrategy): this
  scaling(policy: ScalingPolicy): this
  processor(generator: EventGenerator<TState> | ProcessorBuilder<TState>): this
}
