import { EventGenerator } from '../../event-generator.js'
import { Buildable } from './__internal__.js'
import { ProcessorEntity } from '../entities/processor-entity.js'

export interface ProcessorBuilder<TEvent, TState>
  extends Buildable<ProcessorEntity<TEvent, TState>> {
  processor(generator: EventGenerator<TEvent, TState>): this
}
