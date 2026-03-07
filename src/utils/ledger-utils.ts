import { CommittedEvent } from '../interfaces/event.js'
import { getInitialEventHash } from './crypto-utils.js'
import { isCommitedEvent, isObject } from './guards.js'

export interface LedgerValidationResult {
    isValid: boolean
    error?: string
    lastValidSequence?: number
}

/**
 * Verifies the authenticity and integrity of a sequence of committed events.
 * It checks the hash chain (prevHash) and the validity of each event's hash.
 */
export async function verifyLedgerAuthenticity(
    events: AsyncIterable<unknown> | unknown[]
): Promise<LedgerValidationResult> {
    let lastHash = getInitialEventHash()
    let lastSequence = 0

    try {
        for await (const item of events) {
            if (!isObject(item)) {
                return {
                    isValid: false,
                    error: `Ledger contains a non-object entry at sequence ${lastSequence + 1}`,
                    lastValidSequence: lastSequence,
                }
            }

            const candidate = item as Partial<CommittedEvent>

            if (!isCommitedEvent(item)) {
                return {
                    isValid: false,
                    error: `Invalid event structure or hash mismatch at sequence ${candidate.sequenceNumber ?? lastSequence + 1}`,
                    lastValidSequence: lastSequence,
                }
            }

            const event: CommittedEvent = item

            if (event.prevHash !== lastHash) {
                return {
                    isValid: false,
                    error: `Hash chain broken at sequence ${event.sequenceNumber}. Expected prevHash ${lastHash}, got ${event.prevHash}`,
                    lastValidSequence: lastSequence,
                }
            }

            if (event.sequenceNumber !== lastSequence + 1) {
                return {
                    isValid: false,
                    error: `Sequence gap detected at sequence ${event.sequenceNumber}. Expected ${lastSequence + 1}, got ${event.sequenceNumber}`,
                    lastValidSequence: lastSequence,
                }
            }

            lastHash = event.hash
            lastSequence = event.sequenceNumber
        }

        return { isValid: true, lastValidSequence: lastSequence }
    } catch (error: any) {
        return {
            isValid: false,
            error: `Unexpected error during ledger verification: ${error.message}`,
            lastValidSequence: lastSequence,
        }
    }
}
