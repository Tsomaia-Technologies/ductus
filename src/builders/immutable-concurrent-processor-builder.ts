import { BUILD } from '../interfaces/builders/__internal__.js'
import { ProcessorEntity } from '../interfaces/entities/processor-entity.js'
import { ConcurrentProcessorBuilder } from '../interfaces/builders/concurrent-processor-builder.js'
import { BaseEvent, CommittedEvent, EventDefinition } from '../interfaces/event.js'
import { ConcurrentHandler, createConcurrentProcessor } from '../core/coordination/createConcurrentProcessor.js'
import { isEventDefinition } from '../utils/guards.js'

interface ImmutableConcurrentProcessorBuilderParams<TState, TEvent extends CommittedEvent = CommittedEvent> {
  name?: string | null
  filter?: (event: CommittedEvent) => boolean
  handler?: ConcurrentHandler<TState, TEvent>
  maxConcurrency?: number
}

export class ImmutableConcurrentProcessorBuilder<TState, TEvent extends CommittedEvent = CommittedEvent>
  implements ConcurrentProcessorBuilder<TState, TEvent> {
  private params: ImmutableConcurrentProcessorBuilderParams<TState, TEvent>

  constructor() {
    this.params = {}
  }

  name(name: string | null) {
    return this.clone({ name })
  }

  maxConcurrency(maxConcurrency: number) {
    return this.clone({ maxConcurrency })
  }

  when<T extends string, P>(
    event: EventDefinition<T, P>,
  ): ConcurrentProcessorBuilder<TState, CommittedEvent<BaseEvent<T, P>>>
  when<T extends string, P>(
    filter: (input: CommittedEvent) => input is CommittedEvent<BaseEvent<T, P>>,
  ): ConcurrentProcessorBuilder<TState, CommittedEvent<BaseEvent<T, P>>>
  when(
    filter: (input: CommittedEvent) => boolean,
  ): ConcurrentProcessorBuilder<TState>
  when(
    eventOrFilter: EventDefinition | ((event: CommittedEvent) => boolean),
  ): ConcurrentProcessorBuilder<TState> {
    if (isEventDefinition(eventOrFilter)) {
      return this.clone({
        filter: (eventOrFilter as EventDefinition).is,
      })
    }

    return this.clone({
      filter: eventOrFilter,
    })
  }

  handler(handler: ConcurrentHandler<TState, TEvent>) {
    return this.clone({ handler })
  }

  [BUILD](): ProcessorEntity<TState> {
    if (!this.params.maxConcurrency) throw new Error('Processor requires a maxConcurrency >= 1.')
    if (!this.params.handler) throw new Error('Processor requires a handler function.')

    return {
      name: this.params.name ?? null,
      process: createConcurrentProcessor({
        maxConcurrency: this.params.maxConcurrency,
        filter: this.params.filter,
        handle: this.params.handler,
      }),
    }
  }

  private clone(
    params: Partial<ImmutableConcurrentProcessorBuilderParams<TState, TEvent>>,
  ): ConcurrentProcessorBuilder<TState, TEvent> {
    const Constructor = this.constructor as new () => ImmutableConcurrentProcessorBuilder<TState, TEvent>
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
