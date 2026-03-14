import { BaseEvent, CommittedEvent, EventDefinition } from '../interfaces/event.js'
import { createIntentFactory } from '../utils/internals.js'

export const RequestIntent = createIntentFactory<'RequestIntent', {
  event: BaseEvent
  response: string | EventDefinition
  timeoutMs?: number
}>('RequestIntent')

export const ResponseIntent = createIntentFactory<'ResponseIntent', {
  request: CommittedEvent
  response: BaseEvent
}>('ResponseIntent')
