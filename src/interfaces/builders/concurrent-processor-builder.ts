import { EventGenerator } from '../event-generator.js'
import { DistributionStrategy } from '../coordination/distribution-strategy.js'
import { ProcessorBuilder } from './processor-builder.js'
import { BaseEvent, EventDefinition, InferredEvent } from '../event.js'

export interface ConcurrentProcessorBuilder<TState, TEvent = BaseEvent>
  extends ProcessorBuilder<TState> {
  name(name: string | null): this
  when<TType, TPayload>(event: EventDefinition<TType, TPayload>): ConcurrentProcessorBuilder<TState, BaseEvent<>>
  when<TType, TPayload>(eventOrFilter: EventDefinition | ((event: EventDefinition) => boolean)): ConcurrentProcessorBuilder<TState, BaseEvent<>>
  maxConcurrency(maxConcurrency: number): this
  strategy(strategy: DistributionStrategy): this
  processor(generator: EventGenerator<TState> | ProcessorBuilder<TState>): this
}
