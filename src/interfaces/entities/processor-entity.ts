import { EventGenerator } from '../event-generator.js'
import { BaseEvent } from '../event.js'

export interface ProcessorEntity<TEvent extends BaseEvent, TState> {
  processor: EventGenerator<TEvent, TState>
}
