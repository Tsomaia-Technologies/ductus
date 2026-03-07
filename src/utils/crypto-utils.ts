import * as crypto from 'crypto'
import { CommittedEvent } from '../interfaces/event.js'
import { v4 } from 'uuid'

export function uuid() {
  return v4()
}

export function sha256(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function getInitialEventHash() {
  return '0'.repeat(64)
}

export function getEventHash(event: Omit<CommittedEvent, 'hash'>) {
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
