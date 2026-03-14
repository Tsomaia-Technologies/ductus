import { BaseEvent, CommittedEvent, EventDefinition } from '../event.js'
import { ConcurrentHandler } from '../../core/coordination/createConcurrentProcessor.js'
import { Buildable } from './__internal__.js'
import { ProcessorEntity } from '../entities/processor-entity.js'

export interface ConcurrentProcessorBuilder<TState, TEvent extends CommittedEvent = CommittedEvent>
  extends Buildable<ProcessorEntity<TState>> {
  name(name: string | null): ConcurrentProcessorBuilder<TState, TEvent>

  when<TType extends string, TPayload>(
    event: EventDefinition<TType, TPayload>,
  ): ConcurrentProcessorBuilder<TState, CommittedEvent<BaseEvent<TType, TPayload>>>

  when<TType extends string, TPayload>(
    filter: (input: CommittedEvent) => input is CommittedEvent<BaseEvent<TType, TPayload>>,
  ): ConcurrentProcessorBuilder<TState, CommittedEvent<BaseEvent<TType, TPayload>>>

  when(
    filter: (input: CommittedEvent) => boolean,
  ): ConcurrentProcessorBuilder<TState>

  maxConcurrency(maxConcurrency: number): ConcurrentProcessorBuilder<TState, TEvent>

  handler(
    handler: ConcurrentHandler<TState, TEvent>,
  ): ConcurrentProcessorBuilder<TState, TEvent>
}
