# R02 — Route Observation Events Through Multiplexer

**Severity:** CRITICAL
**Audit ref:** C3
**Depends on:** R00, R01
**Blocks:** None

---

## Problem

`invokeAndParseV2` collects observation events into a local array and returns them. They are never yielded into the event pipeline or committed through the sequencer/multiplexer. Per RFC Section 11: "Observation events flow through the multiplexer like any other event. Any processor can subscribe."

---

## 1. Exploration

Read and understand:

- `src/core/agent-dispatcher.ts` — `invokeAndParseV2()` return value `{ output, observationEvents }`
- `src/utils/internals.ts` — `executePipeline()` which is a generator (`OutputEventStream`)
- `src/core/intent-processor.ts` — how yielded events from processors reach the sequencer/multiplexer
- `src/interfaces/event.ts` — `BaseEvent`, `Volatility`

Trace the path: processor yields event → IntentProcessor broadcasts → sequencer commits (or skips for volatile) → multiplexer distributes.

---

## 2. Implementation

### 2.1 Yield observation events from `executePipeline`

After R00 wires `invokeAndParseV2` into the invoke step, the returned `observationEvents` must be yielded from `executePipeline`:

```typescript
case 'invoke':
  lastAgent = step.agent
  lastSkill = step.skill
  const { output, observationEvents } = await dispatcher.invokeAndParseV2(
    step.agent.name,
    step.skill.name,
    lastInvokeResult,
  )
  lastInvokeResult = output
  for (const obsEvent of observationEvents) {
    yield obsEvent
  }
  break
```

### 2.2 Verify volatile events are handled correctly

Volatile events (`volatility: 'volatile'`) should be broadcast to subscribers but NOT persisted to the ledger. Verify that the sequencer/multiplexer already handles this distinction based on the event's `volatility` field. If not, this needs to be addressed.

### 2.3 Verify durable observation events persist

When an observation event is configured with `volatility: 'durable'`, it should be committed to the ledger like any normal event. Verify this path works.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Write a test that sets up a kernel with a reaction + observation-emitting agent + a processor that consumes observation events. Verify the processor receives the events.
- Run existing tests

---

## 4. Report

- Files modified
- Confirmed event flow: invokeAgent → onEvent → observationEvents array → yield from pipeline → IntentProcessor → multiplexer → subscriber processors

---

## 5. Self-Review

- [ ] Observation events are yielded from `executePipeline`
- [ ] Volatile events reach processors but do not persist to ledger
- [ ] Durable events persist to ledger
- [ ] Event flow is end-to-end verified
- [ ] No duplicate events (each observation event yielded exactly once)

---

## 6. Manual Review Request

Highlight:
1. Is the yield point correct (after invoke, before next pipeline step)?
2. Does the volatile/durable distinction work through the existing sequencer?
3. Could observation events interfere with the reducer or cause unexpected state changes?
