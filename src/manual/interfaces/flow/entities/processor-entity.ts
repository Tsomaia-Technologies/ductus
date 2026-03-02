import { EventGenerator } from '../../event-generator.js'

export interface ProcessorEntity<TEvent, TState> {
  processor(generator: EventGenerator<TEvent, TState>): this
}
