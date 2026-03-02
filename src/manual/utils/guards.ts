import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { getEventHash } from './crypto-utils.js'

export function isObject(input: unknown): input is object {
  return typeof input === 'object' && input !== null
}

export function isCommitedEvent(input: unknown): input is CommittedEvent<BaseEvent> {
  if (!isObject(input)) {
    return false
  }

  const event = input as CommittedEvent<BaseEvent>
  const hash = getEventHash(event)

  return event.hash === hash
}

