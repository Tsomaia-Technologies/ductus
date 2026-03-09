import { BUILD } from '../interfaces/builders/__internal__.js'
import { ProcessorEntity } from '../interfaces/entities/processor-entity.js'
import { EventGenerator } from '../interfaces/event-generator.js'
import { FixedClusterBuilder } from '../interfaces/builders/fixed-cluster-builder.js'
import { DistributionStrategy } from '../interfaces/coordination/distribution-strategy.js'
import { createFixedCluster } from '../core/coordination/createFixedCluster.js'
import { RoundRobinStrategy } from '../core/coordination/distribution/round-robin-strategy.js'

interface ImmutableFixedClusterBuilderParams<TState> {
  name?: string | null
  size?: number
  strategy?: DistributionStrategy
  processor?: EventGenerator<TState>
}

export class ImmutableFixedClusterBuilder<TState> implements FixedClusterBuilder<TState> {
  private params: ImmutableFixedClusterBuilderParams<TState>

  constructor() {
    this.params = {}
  }

  name(name: string | null) {
    return this.clone({ name })
  }

  size(size: number) {
    return this.clone({ size })
  }

  strategy(strategy: DistributionStrategy) {
    return this.clone({ strategy })
  }

  processor(processor: EventGenerator<TState>): this {
    return this.clone({ processor })
  }

  [BUILD](): ProcessorEntity<TState> {
    if (!this.params.size) throw new Error('Processor requires a size value.')
    if (!this.params.processor) throw new Error('Processor requires a processor function.')

    return {
      name: this.params.name ?? null,
      process: createFixedCluster({
        size: this.params.size,
        strategy: this.params.strategy ?? new RoundRobinStrategy(),
        processor: this.params.processor,
      }),
    }
  }

  private clone(params: Partial<ImmutableFixedClusterBuilderParams<TState>>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
