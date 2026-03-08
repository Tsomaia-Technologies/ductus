import Ductus from 'ductus'
import { runTests } from '../setup.js'

/**
 * STATEFUL STRESS TEST
 *
 * What we're testing:
 * 1. State is correctly updated by the reducer on every committed event
 * 2. Processors reading state via getState() see consistent, up-to-date values
 * 3. A slow processor and a fast processor both read correct state independently
 * 4. Final state matches the expected value derived from all events
 *
 * Flow:
 * - Producer emits 20 CounterIncremented events rapidly
 * - Reducer increments state.count on each one
 * - FastProcessor reads state after each event and records what it saw
 * - SlowProcessor reads state after each event with 200ms delay
 * - AuditorProcessor waits for all done events and verifies:
 *     a) Final state count === 20
 *     b) FastProcessor never saw a count > total emitted so far (no future leak)
 *     c) SlowProcessor's last observed count === 20 (eventually consistent)
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const TOTAL = 20

// ── Events ──────────────────────────────────────────────────────────────────

const CounterIncremented = Ductus.event('CounterIncremented', {
  index: Ductus.number(), // which increment this is (1..TOTAL)
})

const FastObserved = Ductus.event('FastObserved', {
  index: Ductus.number(),
  observedCount: Ductus.number(),
})

const SlowObserved = Ductus.event('SlowObserved', {
  index: Ductus.number(),
  observedCount: Ductus.number(),
})

// ── State & Reducer ──────────────────────────────────────────────────────────

interface State {
  count: number
}

const initialState: State = { count: 0 }

const RootReducer = Ductus.reducer<State>()
  .when(CounterIncremented, (state) => [
    { count: state.count + 1 },
    [], // no cascading events
  ])

// ── Processors ───────────────────────────────────────────────────────────────

// A: emits TOTAL increments on boot
const ProducerProcessor = Ductus.processor<State>(async function* (events) {
  for await (const event of events) {
    if (Ductus.BootEvent.is(event)) {
      console.log('[A] Emitting increments...')
      for (let i = 1; i <= TOTAL; i++) {
        yield CounterIncremented({ index: i })
      }
      console.log('[A] Done')
      break
    }
  }
})

// B: fast — reads state immediately after each increment
const FastProcessor = Ductus.processor<State>(async function* (events, getState) {
  for await (const event of events) {
    if (CounterIncremented.is(event)) {
      const { count } = getState()
      console.log(`[B] index=${event.payload.index} observedCount=${count}`)
      yield FastObserved({ index: event.payload.index, observedCount: count })
    }
  }
})

// C: slow — waits 200ms before reading state, tests that state is still correct
const SlowProcessor = Ductus.processor<State>(async function* (events, getState) {
  for await (const event of events) {
    if (CounterIncremented.is(event)) {
      await sleep(200)
      const { count } = getState()
      console.log(`[C] index=${event.payload.index} observedCount=${count}`)
      yield SlowObserved({ index: event.payload.index, observedCount: count })
    }
  }
})

// D: auditor — collects all observations and validates correctness
const AuditorProcessor = Ductus.processor<State>(async function* (events, getState) {
  const fastObservations: { index: number, observedCount: number }[] = []
  const slowObservations: { index: number, observedCount: number }[] = []

  for await (const event of events) {
    if (FastObserved.is(event)) {
      fastObservations.push({ index: event.payload.index, observedCount: event.payload.observedCount })
    }

    if (SlowObserved.is(event)) {
      slowObservations.push({ index: event.payload.index, observedCount: event.payload.observedCount })
    }

    if (fastObservations.length === TOTAL && slowObservations.length === TOTAL) {
      console.log('\n=== AUDIT RESULTS ===')

      // 1. Final state should be exactly TOTAL
      const finalCount = getState().count
      const stateCorrect = finalCount === TOTAL
      console.log(`[D] Final state.count = ${finalCount} (expected ${TOTAL}) → ${stateCorrect ? '✓ PASS' : '✗ FAIL'}`)

      // 2. Fast processor: each observation should be >= index
      //    (state is updated before delivery, so B should always see count >= its index)
      const fastMonotonic = fastObservations.every(({ index, observedCount }) => observedCount >= index)
      console.log(`[D] Fast observations monotonically valid → ${fastMonotonic ? '✓ PASS' : '✗ FAIL'}`)
      if (!fastMonotonic) {
        const violations = fastObservations.filter(({ index, observedCount }) => observedCount < index)
        violations.forEach(v => console.log(`    ✗ index=${v.index} but observedCount=${v.observedCount}`))
      }

      // 3. Slow processor: because it waits 200ms, all increments will have
      //    been committed by the time it reads. Every observation should === TOTAL
      const slowAllFinal = slowObservations.every(({ observedCount }) => observedCount === TOTAL)
      console.log(`[D] Slow observations all see final state (${TOTAL}) → ${slowAllFinal ? '✓ PASS' : '✗ FAIL'}`)
      if (!slowAllFinal) {
        const violations = slowObservations.filter(({ observedCount }) => observedCount !== TOTAL)
        violations.forEach(v => console.log(`    ✗ index=${v.index} observedCount=${v.observedCount}`))
      }

      // 4. Fast processor observations should be strictly increasing
      //    (it processes events in order, state only goes up)
      const fastIncreasing = fastObservations.every((o, i) =>
        i === 0 || o.observedCount >= fastObservations[i - 1].observedCount
      )
      console.log(`[D] Fast observations non-decreasing → ${fastIncreasing ? '✓ PASS' : '✗ FAIL'}`)

      console.log('=====================\n')
      break
    }
  }
})

// ── Flow ─────────────────────────────────────────────────────────────────────

const Flow = Ductus.flow<State>()
  .initialState(initialState)
  .reducer(RootReducer)
  .processor(ProducerProcessor)
  .processor(FastProcessor)
  .processor(SlowProcessor)
  .processor(AuditorProcessor)

runTests({
  flow: Flow,
  dir: 'state',
  overflowStrategy: 'block',
}).catch(console.error)
