import { EventGenerator } from '../event-generator.js'
import { Buildable } from './__internal__.js'
import { ProcessorEntity } from '../entities/processor-entity.js'

export interface ProcessorBuilder<TState> extends Buildable<ProcessorEntity<TState>> {
  name(name: string | null): this
  processor(generator: EventGenerator<TState>): this
}
