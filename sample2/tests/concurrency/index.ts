import Ductus from 'ductus'
import { runTests } from '../setup.js'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const TickEvent = Ductus.event('TickEvent', {
  tickNumber: Ductus.number(),
  emittedAt: Ductus.number(),
})

const SlowDoneEvent = Ductus.event('SlowDoneEvent', {
  tickNumber: Ductus.number(),
  startedAt: Ductus.number(),
  finishedAt: Ductus.number(),
})

const FastDoneEvent = Ductus.event('FastDoneEvent', {
  tickNumber: Ductus.number(),
  startedAt: Ductus.number(),
  finishedAt: Ductus.number(),
})

// Processor A: emits 10 rapid ticks on boot, then stops
const ProducerProcessor = Ductus.processor(async function* (events) {
  for await (const event of events) {
    if (Ductus.BootEvent.is(event)) {
      console.log('[A] Boot received, emitting 10 ticks rapidly...')

      for (let i = 1; i <= 10; i++) {
        yield TickEvent({ tickNumber: i, emittedAt: Date.now() })
        console.log(`[A] Emitted tick ${i}`)
      }

      console.log('[A] Done emitting')
      break
    }
  }
})

// Processor B: slow — simulates 800ms of work per tick
const SlowProcessor = Ductus.processor(async function* (events) {
  for await (const event of events) {
    if (TickEvent.is(event)) {
      const { tickNumber, emittedAt } = event.payload
      const startedAt = Date.now()

      console.log(`[B] Started processing tick ${tickNumber} (${startedAt - emittedAt}ms after emit)`)
      await sleep(800)
      const finishedAt = Date.now()

      console.log(`[B] Finished tick ${tickNumber} after ${finishedAt - startedAt}ms`)
      yield SlowDoneEvent({ tickNumber, startedAt, finishedAt })
    }
  }
})

// Processor C: fast — simulates 50ms of work per tick
const FastProcessor = Ductus.processor(async function* (events) {
  for await (const event of events) {
    if (TickEvent.is(event)) {
      const { tickNumber, emittedAt } = event.payload
      const startedAt = Date.now()

      console.log(`[C] Started processing tick ${tickNumber} (${startedAt - emittedAt}ms after emit)`)
      await sleep(50)
      const finishedAt = Date.now()

      console.log(`[C] Finished tick ${tickNumber} after ${finishedAt - startedAt}ms`)
      yield FastDoneEvent({ tickNumber, startedAt, finishedAt })
    }
  }
})

// Processor D: observer — tracks how many Fast vs Slow completions happened
// and prints a summary when both have processed all 10 ticks
const ObserverProcessor = Ductus.processor(async function* (events) {
  const slowDone = new Set<number>()
  const fastDone = new Set<number>()
  const TOTAL = 10

  for await (const event of events) {
    if (SlowDoneEvent.is(event)) {
      slowDone.add(event.payload.tickNumber)
      console.log(`[D] SlowDone: ${slowDone.size}/${TOTAL} | FastDone: ${fastDone.size}/${TOTAL}`)
    }

    if (FastDoneEvent.is(event)) {
      fastDone.add(event.payload.tickNumber)
      console.log(`[D] SlowDone: ${slowDone.size}/${TOTAL} | FastDone: ${fastDone.size}/${TOTAL}`)
    }

    if (slowDone.size === TOTAL && fastDone.size === TOTAL) {
      console.log('\n=== RESULT ===')
      console.log('If C processed multiple ticks while B was still on tick 1,')
      console.log('the FastDone count will have raced ahead of SlowDone.')
      console.log('Check the timestamps above to verify independent progress.')
      break
    }
  }
})

const Flow = Ductus.flow()
  .initialState({})
  .reducer(Ductus.reducer())

  .processor(ProducerProcessor)
  .processor(SlowProcessor)
  .processor(FastProcessor)
  .processor(ObserverProcessor)

runTests({
  flow: Flow,
  dir: 'concurrency',
}).catch(console.error)
