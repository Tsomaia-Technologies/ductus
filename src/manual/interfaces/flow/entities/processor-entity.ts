import { EventGenerator } from '../../event-generator.js'

export interface ProcessorEntity<TEvent, TState> {
  processor: EventGenerator<TEvent, TState>
}
