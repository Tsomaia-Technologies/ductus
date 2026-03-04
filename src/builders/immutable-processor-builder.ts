import { BUILD } from '../interfaces/builders/__internal__.js'
import { ProcessorBuilder } from '../interfaces/builders/processor-builder.js'
import { ProcessorEntity } from '../interfaces/entities/processor-entity.js'
import { EventGenerator } from '../interfaces/event-generator.js'
import { BaseEvent } from '../interfaces/event.js'

interface ProcessorBuilderParams<TEvent extends BaseEvent, TState> {
  generator?: EventGenerator<TEvent, TState>
}

export class ImmutableProcessorBuilder<TEvent extends BaseEvent, TState>
  implements ProcessorBuilder<TEvent, TState> {
  private params: ProcessorBuilderParams<TEvent, TState>

  constructor() {
    this.params = {}
  }

  processor(generator: EventGenerator<TEvent, TState>): this {
    return this.clone({ generator })
  }

  [BUILD](): ProcessorEntity<TEvent, TState> {
    if (!this.params.generator) throw new Error('Processor requires a generator function.')

    return {
      processor: this.params.generator,
    }
  }

  private clone(params: Partial<ProcessorBuilderParams<TEvent, TState>>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
