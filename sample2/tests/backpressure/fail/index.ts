import Ductus from 'ductus'
import { runTests } from '../../setup.js'

/**
 * OVERFLOW TEST — strategy: 'fail'
 *
 * Setup:
 * - bufferLimit: 5
 * - Producer emits 20 events with no delay
 * - SlowConsumer takes 500ms per event — will never drain fast enough
 *
 * Expected:
 * - Kernel detects buffer overflow on SlowConsumer's buffer
 * - Kernel shuts down with a clear "buffer overflow" error message
 * - FastConsumer may process some events before shutdown
 * - Process exits — kernel.monitor() rejects or resolves after forced shutdown
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const EMIT_COUNT = 20

const WorkItem = Ductus.event('WorkItem', {
  index: Ductus.number(),
})

const FastDone = Ductus.event('FastDone', {
  index: Ductus.number(),
})

// A: emits 20 events rapidly
const ProducerProcessor = Ductus.processor(async function* ProducerProcessor(events) {
  for await (const event of events) {
    if (Ductus.BootEvent.is(event)) {
      console.log('[A] Emitting rapidly...')
      for (let i = 1; i <= EMIT_COUNT; i++) {
        yield WorkItem({ index: i })
        console.log(`[A] Emitted ${i}`)
      }
      console.log('[A] Done emitting')
      break
    }
  }
})

// B: fast consumer — processes instantly, should be fine
const FastConsumer = Ductus.processor(async function* FastConsumer(events) {
  let count = 0
  for await (const event of events) {
    if (WorkItem.is(event)) {
      count++
      console.log(`[B] Processed ${event.payload.index} (total: ${count})`)
      yield FastDone({ index: event.payload.index })
    }
  }
})

// C: slow consumer — 500ms per event, buffer of 5 means it will overflow
const SlowConsumer = Ductus.processor(async function* SlowConsumer(events) {
  for await (const event of events) {
    if (WorkItem.is(event)) {
      console.log(`[C] Starting slow work on ${event.payload.index}...`)
      await sleep(500)
      console.log(`[C] Done with ${event.payload.index}`)
    }
  }
})

const Flow = Ductus.flow()
  .initialState({})
  .reducer(Ductus.reducer())
  .processor(ProducerProcessor)
  .processor(FastConsumer)
  .processor(SlowConsumer)

console.log('=== OVERFLOW FAIL STRATEGY TEST ===')
console.log(`Buffer limit: 5 | Events: ${EMIT_COUNT} | SlowConsumer: 500ms/event`)
console.log('Expected: kernel shuts down with buffer overflow error\n')

runTests({
  flow: Flow,
  dir: 'backpressure/fail',
  bufferLimit: 5,
  overflowStrategy: 'fail',
}).then(() => {
  console.log('\n[RESULT] kernel.monitor() resolved — kernel shut down')
}).catch((err) => {
  console.error('\n[RESULT] kernel.monitor() rejected:', err.message)
})
