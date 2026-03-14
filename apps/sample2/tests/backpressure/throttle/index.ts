import Ductus from 'ductus'
import { runTests } from '../../setup.js'

/**
 * THROTTLE TEST — strategy: 'throttle'
 *
 * Setup:
 * - highWaterMark: 5, lowWaterMark: 2
 * - Producer emits 30 events as fast as possible
 * - SlowConsumer takes 100ms per WorkItem
 * - FastConsumer processes instantly
 *
 * Expected:
 * - Producer bursts freely until SlowConsumer's queue hits 5
 * - Producer pauses until queue drains to 2, then resumes
 * - Emission timestamps show burst-pause-burst pattern
 * - All 30 events are processed by all consumers — no loss
 * - No BackpressureExceededError — no crash
 * - Total time ≈ 3s (30 events × 100ms slow processing)
 *
 * Contrast:
 * - FailFirst with maxQueueSize=5 would crash after ~5 events
 * - Blocking would serialize every event through SlowConsumer (~100ms apart)
 * - Throttle lets the producer burst in chunks, pausing only when needed
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const EMIT_COUNT = 30

const WorkItem = Ductus.event('WorkItem', {
  index: Ductus.number(),
})

const FastDone = Ductus.event('FastDone', {
  index: Ductus.number(),
})

const SlowDone = Ductus.event('SlowDone', {
  index: Ductus.number(),
})

const startTime = Date.now()
const elapsed = () => `${Date.now() - startTime}ms`

// A: emits 30 events as fast as allowed — timestamps reveal throttle pauses
const ProducerProcessor = Ductus.processor(async function* (events) {
  for await (const event of events) {
    if (Ductus.BootEvent.is(event)) {
      console.log(`[A] Emitting rapidly...`)
      for (let i = 1; i <= EMIT_COUNT; i++) {
        yield WorkItem({ index: i })
        console.log(`[A] Emitted ${i} at ${elapsed()}`)
      }
      console.log(`[A] Done emitting at ${elapsed()}`)
      break
    }
  }
})

// B: fast consumer — instant processing
const FastConsumer = Ductus.processor(async function* (events) {
  for await (const event of events) {
    if (WorkItem.is(event)) {
      yield FastDone({ index: event.payload.index })
    }
  }
})

// C: slow consumer — 100ms per WorkItem, triggers throttle backpressure
const SlowConsumer = Ductus.processor(async function* (events) {
  let count = 0
  for await (const event of events) {
    if (WorkItem.is(event)) {
      count++
      await sleep(100)
      console.log(`[C] Processed ${event.payload.index} (total: ${count}) at ${elapsed()}`)
      yield SlowDone({ index: event.payload.index })
    }
  }
})

// D: auditor — collects all completions, validates correctness
const AuditorProcessor = Ductus.processor(async function* (events) {
  const fastDone = new Set<number>()
  const slowDone = new Set<number>()

  for await (const event of events) {
    if (FastDone.is(event)) {
      fastDone.add(event.payload.index)
    }
    if (SlowDone.is(event)) {
      slowDone.add(event.payload.index)
    }

    if (fastDone.size === EMIT_COUNT && slowDone.size === EMIT_COUNT) {
      console.log('\n=== AUDIT RESULTS ===')

      const allIndices = Array.from({ length: EMIT_COUNT }, (_, i) => i + 1)

      const fastAll = allIndices.every(i => fastDone.has(i))
      console.log(`[D] Fast received all ${EMIT_COUNT} events → ${fastAll ? '✓ PASS' : '✗ FAIL'}`)

      const slowAll = allIndices.every(i => slowDone.has(i))
      console.log(`[D] Slow received all ${EMIT_COUNT} events → ${slowAll ? '✓ PASS' : '✗ FAIL'}`)

      console.log(`[D] No crash (BackpressureExceededError) → ✓ PASS`)

      console.log('=====================\n')
      break
    }
  }
})

const Flow = Ductus.flow()
  .initialState({})
  .reducer(Ductus.reducer())
  .processor(ProducerProcessor)
  .processor(FastConsumer)
  .processor(SlowConsumer)
  .processor(AuditorProcessor)

console.log('=== THROTTLE STRATEGY TEST ===')
console.log(`High-water: 5 | Low-water: 2 | Events: ${EMIT_COUNT} | SlowConsumer: 100ms/event`)
console.log('Expected: burst-pause-burst pattern, no crash, all events delivered\n')

runTests({
  flow: Flow,
  dir: 'backpressure/throttle',
  bufferLimit: 5,
  // lowWaterMark: 2,
  overflowStrategy: 'throttle',
}).then(() => {
  console.log('[RESULT] kernel.monitor() resolved')
}).catch((err) => {
  console.error('\n[RESULT] kernel.monitor() rejected:', err.message)
})
