import { DuctusKernel, KernelOptions } from '../core/ductus-kernel.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { EventProcessor } from '../interfaces/event-processor.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { StoreAdapter } from '../interfaces/store-adapter.js'
import { Injector } from '../interfaces/event-generator.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { EventSubscriber } from '../interfaces/event-subscriber.js'
import { CancellationToken } from '../interfaces/cancellation-token.js'

describe('DuctusKernel (Exhaustive Baseline)', () => {
    let mockMultiplexer: jest.Mocked<Multiplexer<any>>
    let mockLedger: jest.Mocked<EventLedger<CommittedEvent<any>>>
    let mockStore: jest.Mocked<StoreAdapter<any, any>>
    let mockInjector: jest.Mocked<Injector>
    let mockProcessor1: jest.Mocked<EventProcessor<any, any>>
    let mockProcessor2: jest.Mocked<EventProcessor<any, any>>
    let mockSubscriber: jest.Mocked<EventSubscriber<CommittedEvent<any>>>
    let mockCancelToken: jest.Mocked<CancellationToken>
    let kernel: DuctusKernel<any, any>
    let commitListener: (event: CommittedEvent<any>) => void

    beforeEach(() => {
        mockSubscriber = {
            streamEvents: jest.fn(),
            push: jest.fn(),
            unsubscribe: jest.fn(),
            onUnsubscribe: jest.fn(),
            waitForSpace: jest.fn(),
            isFull: jest.fn(),
            onDrain: jest.fn(),
            streamStats: jest.fn(),
        } as any

        mockMultiplexer = {
            onCommit: jest.fn().mockImplementation((cb) => {
                commitListener = cb
                return jest.fn() // uninstaller
            }),
            subscribe: jest.fn().mockReturnValue(mockSubscriber),
            broadcast: jest.fn().mockResolvedValue(undefined),
        } as any

        mockLedger = {
            readEvents: jest.fn().mockImplementation(async function* () { }),
        } as any

        mockStore = {
            dispatch: jest.fn().mockReturnValue([]),
            getState: jest.fn().mockReturnValue({ val: 1 }),
            loadSnapshot: jest.fn().mockResolvedValue(null),
            saveSnapshot: jest.fn().mockResolvedValue(undefined),
        } as any

        mockInjector = {} as any

        mockProcessor1 = { process: jest.fn() } as any
        mockProcessor2 = { process: jest.fn() } as any

        mockCancelToken = {
            isCancelled: false as any,
            onCancel: jest.fn(),
            cancel: jest.fn((r) => { (mockCancelToken as any).isCancelled = true }),
            throwIfCancelled: jest.fn(),
            wrap: jest.fn(),
            defer: jest.fn()
        } as any

        kernel = new DuctusKernel({
            multiplexer: mockMultiplexer,
            ledger: mockLedger,
            store: mockStore,
            injector: mockInjector,
            processors: [mockProcessor1, mockProcessor2],
            canceller: mockCancelToken,
        })
    })

    describe('Boot Sequence: Hydration & Mounting', () => {
        it('completely drains the ledger iteratively during hydration (O(N) flaw to be fixed)', async () => {
            const history = [
                { sequenceNumber: 1, type: 'Evt1', volatility: 'durable', payload: 'a', isCommited: true, eventId: '1', prevHash: '', hash: '', timestamp: 1 },
                { sequenceNumber: 2, type: 'Evt2', volatility: 'durable', payload: 'b', isCommited: true, eventId: '2', prevHash: '', hash: '', timestamp: 2 },
                { sequenceNumber: 3, type: 'Evt3', volatility: 'durable', payload: 'c', isCommited: true, eventId: '3', prevHash: '', hash: '', timestamp: 3 }
            ] as CommittedEvent<any>[]

            mockLedger.readEvents.mockImplementation(async function* () {
                for (const h of history) yield h
            })

            // Processors return empty streams
            mockProcessor1.process.mockImplementation(async function* () { })
            mockProcessor2.process.mockImplementation(async function* () { })
            mockSubscriber.streamEvents.mockImplementation(async function* () { })

            await kernel.boot()

            // Verify exhaustive hydration
            expect(mockLedger.readEvents).toHaveBeenCalledTimes(1)
            expect(mockStore.dispatch).toHaveBeenCalledTimes(3)
            expect(mockStore.dispatch).toHaveBeenNthCalledWith(1, history[0])
            expect(mockStore.dispatch).toHaveBeenNthCalledWith(2, history[1])
            expect(mockStore.dispatch).toHaveBeenNthCalledWith(3, history[2])

            // Verify processors were mounted
            expect(mockMultiplexer.subscribe).toHaveBeenCalledTimes(2)
            expect(mockProcessor1.process).toHaveBeenCalled()
            expect(mockProcessor2.process).toHaveBeenCalled()
            expect(mockMultiplexer.onCommit).toHaveBeenCalled()

            await kernel.shutdown({ force: true })
        })

        it('allows state inspection directly in processors by passing getState binding', async () => {
            mockProcessor1.process.mockImplementation(async function* (stream, getState) {
                expect(getState()).toEqual({ val: 1 })
            })
            mockProcessor2.process.mockImplementation(async function* () { })
            mockSubscriber.streamEvents.mockImplementation(async function* () { })

            await kernel.boot()
            expect(mockProcessor1.process).toHaveBeenCalled()

            await kernel.shutdown({ force: true })
        })
    })

    describe('Runtime Loop: Processing & Cascading', () => {
        it('relays processor output into multiplexer broadcasts', async () => {
            mockProcessor1.process.mockImplementation(async function* () {
                yield { type: 'ProcessorOutput1' }
                yield { type: 'ProcessorOutput2' }
            })
            mockProcessor2.process.mockImplementation(async function* () { })
            mockSubscriber.streamEvents.mockImplementation(async function* () { })

            await kernel.boot()
            // In a real application, the background monitor loop would be awaited. 
            // the boot creates the mounts asynchronously.
            // Let the microtask queue clear so the process() loops execute their yields.
            await new Promise(r => setTimeout(r, 10))

            expect(mockMultiplexer.broadcast).toHaveBeenCalledTimes(2)
            expect(mockMultiplexer.broadcast).toHaveBeenCalledWith({ type: 'ProcessorOutput1' })
            expect(mockMultiplexer.broadcast).toHaveBeenCalledWith({ type: 'ProcessorOutput2' })

            await kernel.shutdown({ force: true })
        })

        it('dispatches multiplexer commits to the store and orchestrates pure, un-correlated cascading logic', async () => {
            mockProcessor1.process.mockImplementation(async function* () { })
            mockProcessor2.process.mockImplementation(async function* () { })
            mockSubscriber.streamEvents.mockImplementation(async function* () { })

            await kernel.boot()

            // Store responds to the commit with new events
            mockStore.dispatch.mockReturnValueOnce([
                { type: 'CascadeEventA' },
                { type: 'CascadeEventB' }
            ])

            // Trigger the onCommit listener manually
            const incomingCommit = { type: 'RootCausationEvent', eventId: 'ROOT', sequenceNumber: 10 } as any
            commitListener(incomingCommit)

            await new Promise(r => setImmediate(r))
            await new Promise(r => setTimeout(r, 10))

            // The cascading loop pulls from the LinkedList and broadcasts WITH CAUSALITY
            expect(mockStore.dispatch).toHaveBeenCalledWith(incomingCommit)
            expect(mockMultiplexer.broadcast).toHaveBeenCalledWith(
                { type: 'CascadeEventA' },
                { causationId: 'ROOT', correlationId: 'ROOT' }
            )
            expect(mockMultiplexer.broadcast).toHaveBeenCalledWith(
                { type: 'CascadeEventB' },
                { causationId: 'ROOT', correlationId: 'ROOT' }
            )

            await kernel.shutdown({ force: true })
        })
    })

    describe('Shutdown & Cancellation', () => {
        it('aborts processing loops and unsubscribes bridges forcefully when requested', async () => {
            mockProcessor1.process.mockImplementation(async function* () { })
            mockProcessor2.process.mockImplementation(async function* () { })
            mockSubscriber.streamEvents.mockImplementation(async function* () { })

            await kernel.boot()
            expect(mockCancelToken.isCancelled).toBe(false)

            await kernel.shutdown({ force: true })

            // The kernel uses a derived canceller so the base is NOT notified, but internal loops exit.

            // Subscriptions should be severed instantly
            expect(mockSubscriber.unsubscribe).toHaveBeenCalledTimes(2)
            expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith({ drain: false })

            // Since kernel creates its own internal Canceller wrapper, we know the loops evaluate it,
            // resulting in resolution of the mountResolver. If it didn't, the test would hang.
        })
    })
})
