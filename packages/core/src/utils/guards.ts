import { CommittedEvent, EVENT_DEFINITION, EventDefinition } from '../interfaces/event.js'
import { getEventHash } from './crypto-utils.js'

export function isObject(input: unknown): input is object {
  return typeof input === 'object' && input !== null
}

export function isCommitedEvent(input: unknown): input is CommittedEvent {
  if (!isObject(input)) {
    return false
  }

  const event = input as CommittedEvent
  const hash = getEventHash(event)

  return event.hash === hash
}

export function isEventDefinition(input: unknown): input is EventDefinition {
  return typeof input === 'function' && input.hasOwnProperty(EVENT_DEFINITION)
}
