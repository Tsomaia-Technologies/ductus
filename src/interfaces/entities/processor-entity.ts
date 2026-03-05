import { EventGenerator } from '../event-generator.js'

export interface ProcessorEntity<TState> {
  processor: EventGenerator<TState>
}
