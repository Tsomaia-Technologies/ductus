import * as crypto from 'crypto'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'

export function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function getInitialEventHash() {
  return '0'.repeat(64)
}

export function getEventHash<TEvent extends BaseEvent>(event: Omit<CommittedEvent<TEvent>, 'hash'>) {
  const hashPayload = JSON.stringify({
    type: event.type,
    payload: event.payload,
    authorId: event.authorId,
    timestamp: event.timestamp,
    volatility: event.volatility,

    eventId: event.eventId,
    sequenceNumber: event.sequenceNumber,
    prevHash: event.prevHash,
    isCommited: event.isCommited,
  })

  return sha256(hashPayload)
}
