import { EventGenerator } from '../event-generator.js'

export interface ProcessorEntity<TState> {
  name?: string | null
  process: EventGenerator<TState>
}
