import { BUILD } from '../interfaces/builders/__internal__.js'
import { ProcessorEntity } from '../interfaces/entities/processor-entity.js'
import { EventGenerator } from '../interfaces/event-generator.js'
import { DistributionStrategy } from '../interfaces/coordination/distribution-strategy.js'
import { createDynamicCluster } from '../core/coordination/createDynamicCluster.js'
import { RoundRobinStrategy } from '../core/coordination/distribution/round-robin-strategy.js'
import { ScalingPolicy } from '../interfaces/coordination/scaling-policy.js'
import { DynamicClusterBuilder } from '../interfaces/builders/dynamic-cluster-builder.js'
import { QueueDepthScalingPolicy } from '../core/coordination/scaling/queue-depth-scaling-policy.js'

interface ImmutableDynamicClusterBuilderParams<TState> {
  name?: string | null
  min?: number
  max?: number
  strategy?: DistributionStrategy
  scaling?: ScalingPolicy
  processor?: EventGenerator<TState>
}

export class ImmutableDynamicClusterBuilder<TState> implements DynamicClusterBuilder<TState> {
  private params: ImmutableDynamicClusterBuilderParams<TState>

  constructor() {
    this.params = {}
  }

  name(name: string | null) {
    return this.clone({ name })
  }

  min(min: number) {
    return this.clone({ min })
  }

  max(max: number) {
    return this.clone({ max })
  }

  strategy(strategy: DistributionStrategy) {
    return this.clone({ strategy })
  }

  scaling(scaling: ScalingPolicy) {
    return this.clone({ scaling })
  }

  processor(processor: EventGenerator<TState>): this {
    return this.clone({ processor })
  }

  [BUILD](): ProcessorEntity<TState> {
    if (!this.params.min) throw new Error('Processor requires a min value.')
    if (!this.params.max) throw new Error('Processor requires a max value.')
    if (!this.params.processor) throw new Error('Processor requires a processor function.')

    return {
      name: this.params.name ?? null,
      process: createDynamicCluster({
        min: this.params.min,
        max: this.params.max,
        strategy: this.params.strategy ?? new RoundRobinStrategy(),
        scaling: this.params.scaling ?? new QueueDepthScalingPolicy(),
        processor: this.params.processor,
      }),
    }
  }

  private clone(params: Partial<ImmutableDynamicClusterBuilderParams<TState>>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
