import { DuctusKernel, KernelOptions } from '../core/ductus-kernel.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { EventProcessor } from '../interfaces/event-processor.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { StoreAdapter } from '../interfaces/store-adapter.js'
import { Injector } from '../interfaces/event-generator.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'

describe('DuctusKernel (Baseline)', () => {
    let mockMultiplexer: jest.Mocked<Multiplexer<any>>
    let mockLedger: jest.Mocked<EventLedger<CommittedEvent<any>>>
    let mockStore: jest.Mocked<StoreAdapter<any, any>>
    let mockInjector: jest.Mocked<Injector>
    let mockProcessor: jest.Mocked<EventProcessor<any, any>>
    let kernel: DuctusKernel<any, any>

    beforeEach(() => {
        mockMultiplexer = {
            onCommit: jest.fn(),
            subscribe: jest.fn().mockReturnValue({ streamEvents: jest.fn().mockReturnValue((async function* () { })()) }),
            broadcast: jest.fn(),
        } as any

        mockLedger = {
            readEvents: jest.fn().mockImplementation(async function* () { }),
        } as any

        mockStore = {
            dispatch: jest.fn().mockReturnValue([]),
            getState: jest.fn(),
        } as any

        mockInjector = {} as any

        mockProcessor = {
            process: jest.fn().mockReturnValue((async function* () { })()),
        } as any

        kernel = new DuctusKernel({
            multiplexer: mockMultiplexer,
            ledger: mockLedger,
            store: mockStore,
            injector: mockInjector,
            processors: [mockProcessor],
        })
    })

    describe('Hydration and Boot (To Be Refactored)', () => {

        it('currently replays all events from the ledger causing O(N) constraints (Needs Snapshotting)', async () => {
            const events = [
                { sequenceNumber: 1, type: 'EventA' },
                { sequenceNumber: 2, type: 'EventB' }
            ]

            mockLedger.readEvents.mockImplementation(async function* () {
                for (const event of events) {
                    yield event
                }
            })

            await kernel.boot()

            // Verifies that hydrateStore currently blindly consumes the whole ledger iterable
            expect(mockLedger.readEvents).toHaveBeenCalled()
            expect(mockStore.dispatch).toHaveBeenCalledTimes(2)
            expect(mockStore.dispatch).toHaveBeenCalledWith(events[0])
            expect(mockStore.dispatch).toHaveBeenCalledWith(events[1])
        })

        it('currently propagates events naively leading to cascading loops (Needs Causation Tracking)', async () => {
            // Setup the onCommit listener to simulate a cascade
            let commitCallback: any
            mockMultiplexer.onCommit.mockImplementation((cb) => {
                commitCallback = cb
                return () => { }
            })

            await kernel.boot()

            // Ensure the commit callback is registered
            expect(commitCallback).toBeDefined()

            // To be refactored: Currently, if dispatch returns events, they go into cascadingEvents 
            // and are blindly broadcasted back to the multiplexer without correlation/causation IDs
            mockStore.dispatch.mockReturnValueOnce([{ type: 'CascadedEvent' }])

            commitCallback({ type: 'TriggerEvent' })

            // In a real execution, the mountCascadingEvents loop would pick this up
            // This test just asserts the structural setup where dispatch output goes to cascade
            expect(mockStore.dispatch).toHaveBeenCalledWith({ type: 'TriggerEvent' })
        })
    })
})
