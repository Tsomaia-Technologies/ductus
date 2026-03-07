import { BaseEvent, EventDefinition } from '../interfaces/event.js'
import { createIntentFactory } from '../utils/internals.js'

export const RequestIntent = createIntentFactory<'RequestIntent', {
  event: BaseEvent
  response: string | EventDefinition
  timeoutMs?: number
}>('RequestIntent')
