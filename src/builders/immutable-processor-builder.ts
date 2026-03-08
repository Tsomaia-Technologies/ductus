import { BUILD } from '../interfaces/builders/__internal__.js'
import { ProcessorBuilder } from '../interfaces/builders/processor-builder.js'
import { ProcessorEntity } from '../interfaces/entities/processor-entity.js'
import { EventGenerator } from '../interfaces/event-generator.js'

interface ProcessorBuilderParams<TState> {
  name?: string | null
  generator?: EventGenerator<TState>
}

export class ImmutableProcessorBuilder<TState> implements ProcessorBuilder<TState> {
  private params: ProcessorBuilderParams<TState>

  constructor() {
    this.params = {}
  }

  name(name: string | null) {
    return this.clone({ name })
  }

  processor(generator: EventGenerator<TState>): this {
    return this.clone({ generator })
  }

  [BUILD](): ProcessorEntity<TState> {
    if (!this.params.generator) throw new Error('Processor requires a generator function.')

    return {
      name: this.params.name ?? null,
      processor: this.params.generator,
    }
  }

  private clone(params: Partial<ProcessorBuilderParams<TState>>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
