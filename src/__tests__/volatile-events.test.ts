import { DefaultEventSequencer } from '../core/default-event-sequencer.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'

jest.mock('../utils/crypto-utils.js', () => ({
  getInitialEventHash: jest.fn().mockReturnValue('GENESIS_HASH'),
  getEventHash: jest.fn().mockImplementation(
    (e: { type: string; sequenceNumber: number }) => `HASH_${e.type}_${e.sequenceNumber}`,
  ),
}))

describe('Volatile Event Support in Sequencer', () => {
  let mockLedger: jest.Mocked<EventLedger>
  let sequencer: DefaultEventSequencer

  beforeEach(() => {
    let uuidCounter = 0
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: jest.fn(() => `uuid-${++uuidCounter}`) },
      writable: true,
    })
    jest.spyOn(Date, 'now').mockImplementation(() => 1000000)

    mockLedger = {
      readEvents: jest.fn().mockImplementation(async function* () {}),
      readLastEvent: jest.fn().mockResolvedValue(null),
      appendEvent: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<EventLedger>

    sequencer = new DefaultEventSequencer(mockLedger)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  function durableEvent(type: string): BaseEvent {
    return { type, payload: {}, volatility: 'durable' } as BaseEvent
  }

  function volatileEvent(type: string): BaseEvent {
    return { type, payload: {}, volatility: 'volatile' } as BaseEvent
  }

  it('persists durable events to the ledger', async () => {
    await sequencer.commit(durableEvent('DurableA'))

    expect(mockLedger.appendEvent).toHaveBeenCalledTimes(1)
    expect(mockLedger.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DurableA', sequenceNumber: 1 }),
    )
  })

  it('does NOT persist volatile events to the ledger', async () => {
    await sequencer.commit(volatileEvent('VolatileA'))

    expect(mockLedger.appendEvent).not.toHaveBeenCalled()
  })

  it('assigns sequence numbers to volatile events', async () => {
    const committed = await sequencer.commit(volatileEvent('VolatileA'))

    expect(committed.sequenceNumber).toBe(1)
    expect(committed.isCommited).toBe(true)
    expect(committed.type).toBe('VolatileA')
  })

  it('triggers commit listener for volatile events (so multiplexers broadcast them)', async () => {
    const listener = jest.fn()
    sequencer.onCommit(listener)

    await sequencer.commit(volatileEvent('VolatileA'))

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ type: 'VolatileA' }),
      }),
    )
  })

  it('maintains hash chain integrity: durable → volatile → durable', async () => {
    const d1 = await sequencer.commit(durableEvent('D1'))
    const v1 = await sequencer.commit(volatileEvent('V1'))
    const d2 = await sequencer.commit(durableEvent('D2'))

    expect(d1.sequenceNumber).toBe(1)
    expect(v1.sequenceNumber).toBe(2)
    expect(d2.sequenceNumber).toBe(3)

    expect(d1.prevHash).toBe('GENESIS_HASH')

    // Volatile event uses the last durable hash as prevHash
    expect(v1.prevHash).toBe(d1.hash)

    // Second durable event links to the first durable event, NOT the volatile event
    expect(d2.prevHash).toBe(d1.hash)

    // Ledger only has durable events
    expect(mockLedger.appendEvent).toHaveBeenCalledTimes(2)
    expect(mockLedger.appendEvent).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ type: 'D1', sequenceNumber: 1 }),
    )
    expect(mockLedger.appendEvent).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ type: 'D2', sequenceNumber: 3 }),
    )
  })

  it('preserves hash chain across multiple volatile events in a row', async () => {
    const d1 = await sequencer.commit(durableEvent('D1'))
    await sequencer.commit(volatileEvent('V1'))
    await sequencer.commit(volatileEvent('V2'))
    const d2 = await sequencer.commit(durableEvent('D2'))

    // D2 prevHash links to D1, skipping both volatile events
    expect(d2.prevHash).toBe(d1.hash)
    expect(mockLedger.appendEvent).toHaveBeenCalledTimes(2)
  })

  it('correctly sequences interleaved durable and volatile events', async () => {
    const d1 = await sequencer.commit(durableEvent('D1'))
    const v1 = await sequencer.commit(volatileEvent('V1'))
    const d2 = await sequencer.commit(durableEvent('D2'))
    const v2 = await sequencer.commit(volatileEvent('V2'))
    const d3 = await sequencer.commit(durableEvent('D3'))

    expect(d1.sequenceNumber).toBe(1)
    expect(v1.sequenceNumber).toBe(2)
    expect(d2.sequenceNumber).toBe(3)
    expect(v2.sequenceNumber).toBe(4)
    expect(d3.sequenceNumber).toBe(5)

    // Hash chain only links durable events
    expect(d1.prevHash).toBe('GENESIS_HASH')
    expect(d2.prevHash).toBe(d1.hash)
    expect(d3.prevHash).toBe(d2.hash)

    // Volatile events reference the last durable hash at time of creation
    expect(v1.prevHash).toBe(d1.hash)
    expect(v2.prevHash).toBe(d2.hash)
  })

  it('handles volatile-only streams without ledger writes', async () => {
    await sequencer.commit(volatileEvent('V1'))
    await sequencer.commit(volatileEvent('V2'))
    await sequencer.commit(volatileEvent('V3'))

    expect(mockLedger.appendEvent).not.toHaveBeenCalled()

    const d1 = await sequencer.commit(durableEvent('D1'))
    expect(d1.prevHash).toBe('GENESIS_HASH')
    expect(d1.sequenceNumber).toBe(4)
    expect(mockLedger.appendEvent).toHaveBeenCalledTimes(1)
  })

  it('resumes correctly after hydration (volatile events are absent from ledger)', async () => {
    mockLedger.readLastEvent.mockResolvedValueOnce({
      sequenceNumber: 5,
      hash: 'HASH_RESTORED',
    } as CommittedEvent)

    const fresh = new DefaultEventSequencer(mockLedger)
    const d1 = await fresh.commit(durableEvent('PostRestore'))

    expect(d1.sequenceNumber).toBe(6)
    expect(d1.prevHash).toBe('HASH_RESTORED')
    expect(mockLedger.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PostRestore', sequenceNumber: 6 }),
    )
  })

  it('backward compat: events with volatility=durable persist normally', async () => {
    const e1 = await sequencer.commit(durableEvent('Legacy1'))
    const e2 = await sequencer.commit(durableEvent('Legacy2'))

    expect(mockLedger.appendEvent).toHaveBeenCalledTimes(2)
    expect(e1.sequenceNumber).toBe(1)
    expect(e2.sequenceNumber).toBe(2)
    expect(e2.prevHash).toBe(e1.hash)
  })
})
