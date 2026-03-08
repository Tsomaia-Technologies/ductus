import { EventGenerator } from '../event-generator.js'

export interface ProcessorEntity<TState> {
  name: string | null
  processor: EventGenerator<TState>
}
