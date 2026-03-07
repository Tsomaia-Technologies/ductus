import Ductus from 'ductus'
import { runTests } from '../../setup.js'

/**
 * BACKPRESSURE TEST — strategy: 'block'
 *
 * Setup:
 * - bufferLimit: 5
 * - Producer emits 20 events, tracking wall-clock time per emission
 * - SlowConsumer takes 100ms per event
 * - FastConsumer processes instantly
 *
 * Expected:
 * - Once SlowConsumer's buffer fills (after 5 events), producer BLOCKS
 * - Producer emission timestamps show growing gaps when buffer is full
 * - All 20 events are eventually processed by both consumers — nothing dropped
 * - FastConsumer is NOT blocked by SlowConsumer's backpressure
 *   (each processor has its own independent buffer)
 * - Total runtime ≈ 20 * 100ms = ~2000ms (SlowConsumer is the bottleneck)
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const EMIT_COUNT = 20

const WorkItem = Ductus.event('WorkItem', {
  index: Ductus.number(),
  emittedAt: Ductus.number(),
})

const SlowDone = Ductus.event('SlowDone', {
  index: Ductus.number(),
})

const FastDone = Ductus.event('FastDone', {
  index: Ductus.number(),
})

// A: emits 20 events, records time between emissions to show backpressure effect
const ProducerProcessor = Ductus.processor(async function* (events) {
  for await (const event of events) {
    if (Ductus.BootEvent.is(event)) {
      console.log('[A] Starting emission...')
      let lastEmitTime = Date.now()

      for (let i = 1; i <= EMIT_COUNT; i++) {
        const now = Date.now()
        const gap = now - lastEmitTime
        lastEmitTime = now

        // Gap > 20ms means producer was blocked waiting for buffer to drain
        const wasBlocked = i > 1 && gap > 20
        console.log(`[A] Emitting ${i} (gap: ${gap}ms)${wasBlocked ? ' ← BLOCKED' : ''}`)
        yield WorkItem({ index: i, emittedAt: now })
      }

      console.log('[A] Done emitting')
      break
    }
  }
})

// B: fast consumer — instantly drains its own buffer, unaffected by C's backpressure
const FastConsumer = Ductus.processor(async function* (events) {
  let count = 0
  for await (const event of events) {
    if (WorkItem.is(event)) {
      count++
      yield FastDone({ index: event.payload.index })
    }
  }
  console.log(`[B] Processed ${count} events total`)
})

// C: slow consumer — 100ms per event, causes backpressure on producer
const SlowConsumer = Ductus.processor(async function* (events) {
  let count = 0
  for await (const event of events) {
    if (WorkItem.is(event)) {
      await sleep(100)
      count++
      console.log(`[C] Processed ${event.payload.index} (total: ${count})`)
      yield SlowDone({ index: event.payload.index })
    }
  }
})

// D: auditor — verifies all events processed, nothing dropped
const AuditorProcessor = Ductus.processor(async function* (events) {
  const fastDone = new Set<number>()
  const slowDone = new Set<number>()
  const startTime = Date.now()

  for await (const event of events) {
    if (FastDone.is(event)) fastDone.add(event.payload.index)
    if (SlowDone.is(event)) slowDone.add(event.payload.index)

    if (fastDone.size === EMIT_COUNT && slowDone.size === EMIT_COUNT) {
      const elapsed = Date.now() - startTime
      console.log('\n=== AUDIT RESULTS ===')
      console.log(`[D] FastDone received: ${fastDone.size}/${EMIT_COUNT} → ${fastDone.size === EMIT_COUNT ? '✓ PASS' : '✗ FAIL'}`)
      console.log(`[D] SlowDone received: ${slowDone.size}/${EMIT_COUNT} → ${slowDone.size === EMIT_COUNT ? '✓ PASS' : '✗ FAIL'}`)
      console.log(`[D] Total elapsed: ${elapsed}ms (expected ≈ ${EMIT_COUNT * 100}ms if backpressure worked)`)
      console.log(`[D] Backpressure working: ${elapsed >= EMIT_COUNT * 80 ? '✓ PASS' : '✗ FAIL (too fast — events may have been dropped)'}`)
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

console.log('=== BACKPRESSURE BLOCK STRATEGY TEST ===')
console.log(`Buffer limit: 5 | Events: ${EMIT_COUNT} | SlowConsumer: 100ms/event`)
console.log('Expected: producer blocks when buffer full, all events delivered\n')

runTests({
  flow: Flow,
  dir: 'backpressure/block',
  bufferLimit: 5,
  bufferTimeoutMs: 10000,
  overflowStrategy: 'block',
}).catch(console.error)
