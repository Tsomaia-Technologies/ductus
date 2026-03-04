import { DuctusMultiplexer } from '../core/ductus-multiplexer.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { BufferedSubscriber } from '../core/buffered-subscriber.js'
import * as cryptoUtils from '../utils/crypto-utils.js'

jest.mock('../utils/crypto-utils.js', () => ({
    getInitialEventHash: jest.fn().mockReturnValue('GENESIS_HASH_XYZ'),
    getEventHash: jest.fn().mockImplementation((e) => `HASH_OF_${e.type}_SEQ_${e.sequenceNumber}`),
}))

describe('DuctusMultiplexer (Exhaustive Baseline)', () => {
    let mockLedger: jest.Mocked<EventLedger<any>>
    let multiplexer: DuctusMultiplexer<any>

    beforeEach(() => {
        // Deterministic global mocks
        let uuidCounter = 0
        Object.defineProperty(globalThis, 'crypto', {
            value: { randomUUID: jest.fn(() => `uuid-mock-${++uuidCounter}`) },
            writable: true
        });

        let timeCounter = 1000000
        jest.spyOn(Date, 'now').mockImplementation(() => timeCounter++)

        mockLedger = {
            readEvents: jest.fn().mockImplementation(async function* () { }),
            readLastEvent: jest.fn().mockResolvedValue(null),
            appendEvent: jest.fn().mockResolvedValue(undefined),
        } as any

        multiplexer = new DuctusMultiplexer({
            ledger: mockLedger,
            // Opting out of passing initialHash and sequenceNumber to verify the unsafe defaults
        })
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('Sequence Advancing & Event Validation', () => {
        it('assigns incrementing sequences, timestamps, IDs, and sequential hash chains', async () => {
            const e1 = { type: 'Evt1' }
            const e2 = { type: 'Evt2' }

            await multiplexer.broadcast(e1)
            await multiplexer.broadcast(e2)

            expect(mockLedger.appendEvent).toHaveBeenCalledTimes(2)

            const firstCommit = mockLedger.appendEvent.mock.calls[0][0]
            const secondCommit = mockLedger.appendEvent.mock.calls[1][0]

            // Assert exact structure of Event 1
            expect(firstCommit).toMatchObject({
                type: 'Evt1',
                sequenceNumber: 1,
                prevHash: 'GENESIS_HASH_XYZ', // Initial default 
                hash: 'HASH_OF_Evt1_SEQ_1',
                eventId: 'uuid-mock-1',
                timestamp: 1000000,
                isCommited: true
            })

            // Assert Object freeze 
            expect(Object.isFrozen(firstCommit)).toBe(true)

            // Assert exact structure of Event 2 building sequentially
            expect(secondCommit).toMatchObject({
                type: 'Evt2',
                sequenceNumber: 2,
                prevHash: 'HASH_OF_Evt1_SEQ_1', // Chained correctly
                hash: 'HASH_OF_Evt2_SEQ_2',
                eventId: 'uuid-mock-2',
                timestamp: 1000001,
            })
        })

        it('syncs with existing ledger using readLastEvent to resume sequence and hash chain', async () => {
            // Assume the user injects a ledger that already has 100 events.
            // Under new design, the Multiplexer MUST resume at sequence 101.
            mockLedger.readLastEvent.mockResolvedValueOnce({
                sequenceNumber: 100,
                hash: 'HASH_OF_Evt100_SEQ_100',
            } as any)

            const multiplexer2 = new DuctusMultiplexer({ ledger: mockLedger })
            const e = { type: 'CrashRecoveryEvent' }
            await multiplexer2.broadcast(e)

            const commit = mockLedger.appendEvent.mock.calls[0][0]

            // Assert it successfully read history and chained off the latest hash
            expect(commit.sequenceNumber).toBe(101)
            expect(commit.prevHash).toBe('HASH_OF_Evt100_SEQ_100')
        })
    })

    describe('Subscriptions and Locks', () => {
        it('pushes frozen committed events to all active subscribers sequentially', async () => {
            const sub1 = multiplexer.subscribe()
            const sub2 = multiplexer.subscribe()

            // Spy on the internal buffered subscriber push mechanism
            jest.spyOn(sub1, 'push').mockResolvedValue(undefined)
            jest.spyOn(sub2, 'push').mockResolvedValue(undefined)

            await multiplexer.broadcast({ type: 'BroadcastTest' })

            expect(sub1.push).toHaveBeenCalledTimes(1)
            expect(sub2.push).toHaveBeenCalledTimes(1)

            const pushedEvent1 = (sub1.push as jest.Mock).mock.calls[0][0]
            const pushedEvent2 = (sub2.push as jest.Mock).mock.calls[0][0]

            expect(pushedEvent1.eventId).toBe(pushedEvent2.eventId) // Same object relayed
            expect(pushedEvent1.sequenceNumber).toBe(1)
        })

        it('cleans up subscribers upon deregistration', async () => {
            const sub1 = multiplexer.subscribe()
            jest.spyOn(sub1, 'push').mockResolvedValue(undefined)

            // Explicitly call the array cleanup block tied to the onUnsubscribe callback
            sub1.unsubscribe({ drain: false })

            await multiplexer.broadcast({ type: 'UnseenEvent' })

            // Assuming unsubscribe resolves the underlying generators, 
            // the bridge array splice should eliminate it.
            expect(sub1.push).not.toHaveBeenCalled()
        })

        it('executes commit listeners synchronously during broadcast', async () => {
            const listener = jest.fn()
            const off = multiplexer.onCommit(listener)

            await multiplexer.broadcast({ type: 'SyncEvent' })

            expect(listener).toHaveBeenCalledTimes(1)
            expect(listener.mock.calls[0][0].type).toBe('SyncEvent')

            off() // Deregister

            await multiplexer.broadcast({ type: 'SyncEvent2' })
            expect(listener).toHaveBeenCalledTimes(1) // Not called again
        })
    })
})
