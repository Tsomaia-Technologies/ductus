import { DuctusMultiplexer } from '../core/ductus-multiplexer.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import * as cryptoUtils from '../utils/crypto-utils.js'

jest.mock('../utils/crypto-utils.js', () => ({
    getInitialEventHash: jest.fn().mockReturnValue('initial-hash-123'),
    getEventHash: jest.fn().mockReturnValue('new-hash-456'),
}))

describe('DuctusMultiplexer (Baseline)', () => {
    let mockLedger: jest.Mocked<EventLedger<any>>
    let multiplexer: DuctusMultiplexer<any>

    beforeEach(() => {
        // Mock global crypto
        Object.defineProperty(globalThis, 'crypto', {
            value: {
                randomUUID: jest.fn().mockReturnValue('uuid-123'),
            },
            writable: true
        });

        // Mock Date.now
        jest.spyOn(Date, 'now').mockReturnValue(1000)

        mockLedger = {
            readEvents: jest.fn(),
            appendEvent: jest.fn().mockResolvedValue(undefined),
        } as any

        multiplexer = new DuctusMultiplexer({
            ledger: mockLedger,
        })
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('Sequence and Hash Integrity (To Be Refactored)', () => {

        it('currently initializes blindly to 0 and initial hash ignoring the ledger (Needs Ledger-Driven Init)', async () => {
            const testEvent = { type: 'TestEvent', payload: 'data' }

            await multiplexer.broadcast(testEvent)

            // Note: The multiplexer NEVER queried `mockLedger.readEvents` or a latest event.
            // It just started sequence at 1, pointing back to the initial hash.
            // If this node restarted with a populated ledger, it would overwrite sequence 1.
            expect(mockLedger.appendEvent).toHaveBeenCalledWith(
                expect.objectContaining({
                    eventId: 'uuid-123',
                    isCommited: true,
                    payload: 'data',
                    prevHash: 'initial-hash-123', // Blindly starts here
                    sequenceNumber: 1,            // Blindly starts at 1
                    timestamp: 1000,
                    type: 'TestEvent'
                })
            )
        })

        it('currently commits events without causation tracking (Needs Causation/Correlation Metadata)', async () => {
            const testEvent = { type: 'CauselessEvent' }

            await multiplexer.broadcast(testEvent)

            // The committed event lacks causationId and correlationId structures
            expect(mockLedger.appendEvent).toHaveBeenCalledWith(
                expect.not.objectContaining({
                    causationId: expect.anything(),
                    correlationId: expect.anything(),
                })
            )
        })
    })
})
