---

## DUCTUS FRAMEWORK — ARCHITECTURE BLUEPRINT

*Serialized: March 8, 2026. Reflects current codebase state after the blocking multiplexer refactor.*

---

### 1. WHAT DUCTUS IS

Ductus is an event sourcing framework for building semi or fully automated agentic workflows. It is written in TypeScript. It leverages async generators as the core abstraction for processor logic. Events are committed to an append-only ledger with hash chaining for tamper detection. State is derived from events via reducers (CQRS pattern). Processors react to committed events and produce new events, forming reactive workflows.

---

### 2. CORE ARCHITECTURE OVERVIEW

The system has a strict separation of concerns:

- **Store/Reducer** → owns state. Synchronous. Receives every committed event, produces new state and optional cascading events. Processors never write state directly.
- **Processors** → own side effects and decision-making. Async generators that consume committed events from their input stream and yield new event drafts. Processors read state (via `getState()`) but never mutate it.
- **Sequencer** → owns event ordering. Assigns sequence numbers, computes hashes, appends to ledger, fires commit listeners. Serialized via mutex.
- **Multiplexer** → owns fan-out and backpressure strategy. Commits events via sequencer, enqueues to all subscriber channels, applies strategy-specific backpressure.
- **EventChannel** → owns per-processor event delivery. A uni-directional queue: enqueue from multiplexer side, stream from processor side, with drain signaling for backpressure.
- **IntentProcessor** → owns the processor lifecycle loop. Drives the processor's async generator, wraps consumption in the channel's `consume()` method, broadcasts yielded events.
- **Kernel** → owns orchestration. Boots the system, mounts processors, manages cascading events from store, handles shutdown.
- **Ledger** → owns persistence. Append-only JSONL file with hash-chain integrity verification.

---

### 3. EVENT FLOW — STEP BY STEP

**3.1 Normal event flow (processor yields an event):**

1. Processor's async generator yields an event draft (BaseEvent)
2. IntentProcessor receives it via `eventsOut.next()`
3. IntentProcessor calls `multiplexer.broadcast(event, { sourceSubscriber, causationId, correlationId })`
4. Inside broadcast: sequencer commits the event (assigns ID, sequence number, hash, appends to ledger)
5. Sequencer's `commitListener` fires synchronously — kernel's `mountStore` callback runs:
   - Stores causation graph node (for cycle detection)
   - Dispatches to store reducer → gets new state + cascading events
   - Queues cascading events into `cascadingEvents` linked list
   - Wakes the cascade loop
6. Broadcast enqueues the committed event to ALL subscriber channels (no source exclusion — see section 5.1)
7. Broadcast applies backpressure per the multiplexer strategy (blocking multiplexer waits for all consuming channels to drain)
8. Broadcast returns the committed event
9. IntentProcessor passes committed event as `nextValue` to the next `eventsOut.next()` call

**3.2 Cascading events (store reducer produces events):**

1. Store reducer returns `[newState, [event1, event2, ...]]`
2. Kernel's `mountStore` callback queues these into `cascadingEvents` linked list
3. The `mountCascadingEvents` loop picks them up one at a time
4. Each is broadcast via `multiplexer.broadcast(event, { causationId, correlationId })` — no sourceSubscriber (system-level event)
5. Cycle detection runs before queueing — causation chain is walked up to depth 100

**3.3 Boot event:**

1. `kernel.boot()` calls `multiplexer.broadcast(BootEvent({ timestamp }))`
2. No sourceSubscriber (system-level event)
3. All processor channels receive it
4. Processors typically use BootEvent as their initialization trigger

**3.4 Intent flow (request/response):**

1. Processor yields a `RequestIntent` containing an event to send and a response event type to wait for
2. IntentProcessor broadcasts the request event with a unique `chainId`
3. IntentProcessor listens on `sequencer.onCommit` for a matching response (same `chainId` + matching type)
4. When another processor yields a `ResponseIntent`, IntentProcessor broadcasts the response with the original `chainId`
5. The original requestor's `onCommit` listener resolves, and the committed response event is passed back to the processor via `yield` return value

---

### 4. KEY FILES AND CLASSES

**4.1 Interfaces:**

| File | Interface | Purpose |
|---|---|---|
| `src/interfaces/event.ts` | `BaseEvent`, `CommittedEvent`, `EventDefinition` | Event types. BaseEvent is a draft (type, payload, volatility). CommittedEvent adds eventId, sequenceNumber, hash, prevHash, timestamp, causation/correlation IDs. Volatility is `'durable'`, `'volatile'`, or `'intent'`. |
| `src/interfaces/event-subscriber.ts` | `EventSubscriber` | Unified subscriber interface: `name()`, `enqueue()`, `isConsuming()`, `consume()`, `waitForDrain()`, `onDrain()`, `streamEvents()`, `unsubscribe()`, `onUnsubscribe()` |
| `src/interfaces/multiplexer.ts` | `Multiplexer`, `BroadcastingContext` | `subscribe()` + `broadcast()`. Strategy is fully encapsulated in broadcast. No `waitForConsumers` on the interface. |
| `src/interfaces/event-sequencer.ts` | `EventSequencer`, `CommitContext`, `CommitEventData` | `commit()` + `onCommit()`. CommitContext carries sourceSubscriber, causationId, correlationId, chainId. |
| `src/interfaces/event-ledger.ts` | `EventLedger` | `readEvents()`, `readLastEvent()`, `appendEvent()`, `dispose()` |
| `src/interfaces/store-adapter.ts` | `StoreAdapter`, `Reducer` | Reducer signature: `(state, event) => [newState, cascadingEvents[]]`. Store: `getState()`, `dispatch()`, optional snapshot load/save. |
| `src/interfaces/cancellation-token.ts` | `CancellationToken`, `Disposer` | `isCancelled()`, `cancel()`, `onCancel()` |
| `src/interfaces/deferrer.ts` | `Deferrer` | `isWaiting()`, `sleep()`, `wakeUpNext()`, `wakeUpAll()` |

**4.2 Core implementations:**

| File | Class | Purpose |
|---|---|---|
| `src/core/event-channel.ts` | `EventChannel` | Universal subscriber implementation. Implements `EventSubscriber`. Used by ALL multiplexer implementations. Contains: event queue (LinkedList), streamDeferrer (wakes streamEvents when event enqueued), drainDeferrer (signals drain to waitForDrain callers), consume() method that wraps callback in isConsuming flag with try/finally. |
| `src/core/multiplexer/blocking-multiplexer.ts` | `BlockingMultiplexer` | Blocking strategy. broadcast enqueues to all channels, then calls private `waitForConsumers()` which awaits drain on all channels where `isConsuming() === true`. Production rate = rate of slowest actively-consuming processor. |
| `src/core/intent-processor.ts` | `IntentProcessor` | Drives processor generator loop. Uses `consumeNext()` helper that wraps `eventsOut.next()` in `sourceSubscriber.consume()` — this sets the channel's consuming flag. Broadcasts yielded events. Handles RequestIntent/ResponseIntent. |
| `src/core/ductus-kernel.ts` | `DuctusKernel` | Orchestrator. `boot()`: hydrates store from ledger, mounts store commit listener, mounts all processors, mounts cascade loop, broadcasts BootEvent. `monitor()`: awaits all processor loops. `shutdown()`: unsubscribes all, with 5s timeout + force kill. |
| `src/core/default-event-sequencer.ts` | `DefaultEventSequencer` | Mutex-serialized commit. Assigns sequential IDs, computes SHA hashes, chains via prevHash, appends to ledger, fires commit listener. Lazy hydration from ledger on first commit. |
| `src/core/ductus-store.ts` | `DuctusStore` | Simple store: holds state, applies reducer on dispatch, returns [newState, cascadingEvents]. |
| `src/core/mutex.ts` | `Mutex` | Async mutex using DefaultDeferrer. FIFO ordering. `lock(execute)` — if locked, sleep; execute under lock; on release, wake next waiter or unlock. |
| `src/core/default-deferrer.ts` | `DefaultDeferrer` | Promise-based sleep/wake queue. `sleep()` returns a promise, enqueues its resolver. `wakeUpNext()` resolves one (FIFO). `wakeUpAll()` resolves all. |
| `src/core/default-event-listener.ts` | `DefaultEventListener<T>` | Pub/sub. `on(callback)` → persistent listener. `once(callback)` → one-shot. `trigger(event)` → fires all once-callbacks (removing them), then all persistent callbacks. |
| `src/core/linked-list.ts` | `LinkedList<T>` | Doubly-linked list with O(1) insert/remove at both ends, O(1) remove-by-token via Map registry. Used everywhere as the queue primitive. |
| `src/core/events.ts` | `BootEvent` | The system boot event: `Ductus/BootEvent` with timestamp payload. |
| `src/core/intents.ts` | `RequestIntent`, `ResponseIntent` | Intent event definitions for the request/response pattern. |
| `src/ledger/jsonl-ledger.ts` | `JsonlLedger` | JSONL file-based ledger. Append-only writes via file handle. Reads with hash-chain verification. |
| `src/system/canceller.ts` | `Canceller` | Cancellation token implementation. Supports parent chaining, force flag, listener notification. |

---

### 5. DESIGN DECISIONS IN EFFECT

**5.1 Processors receive their own events.**

Broadcast enqueues to ALL subscriber channels, including the source processor's own channel. The `sourceSubscriber` exclusion filter was removed. Rationale: the architecture supports it safely. Self-referencing infinite loops (e.g., `if EventA yield EventA`) are a domain-level concern, not a framework concern — same as JavaScript not prohibiting recursion. The causation depth limit (100) in the kernel's cycle detection provides a safety net. During replay, events are NOT re-emitted to processors (processors don't run during replay — only the store/reducer runs), so self-delivery has no replay implications.

**5.2 `sourceSubscriber` is optional — legitimately.**

Two call sites have no sourceSubscriber: BootEvent (from kernel) and cascading events (from store/reducer). Both are system-level events with no originating processor. The undefined correctly represents "no source processor." No fake subscriber is used.

**5.3 Backpressure is fully encapsulated in the multiplexer.**

The `Multiplexer` interface exposes only `subscribe()` and `broadcast()`. There is no `waitForConsumers` on the interface. Each multiplexer implementation decides its own backpressure policy inside `broadcast()`. The IntentProcessor does not know or care about the strategy — it just calls `broadcast()`.

**5.4 EventChannel is the universal subscriber — strategy-independent.**

`EventChannel` (formerly `BlockingSubscriber`) is used by all multiplexer implementations. It is a passive, strategy-agnostic queue with drain signaling. The multiplexer strategy determines when/how to wait on drain. The channel just provides the primitives: `enqueue()`, `waitForDrain()`, `isConsuming()`, `consume()`.

**5.5 The consuming/producing mode distinction prevents deadlock.**

When IntentProcessor calls `eventsOut.next()`, it wraps the call in `sourceSubscriber.consume(callback)`. This sets `_isConsuming = true` during the call (with try/finally for exception safety) and `false` after. The blocking multiplexer's `waitForConsumers()` only awaits drain on channels where `isConsuming() === true`. Channels whose processors are in a producing phase (suspended at yield, not consuming input) are skipped. This prevents the circular-await deadlock where push to a non-consuming channel blocks the entire system.

**5.6 `waitForConsumers` also has no `excludeSubscriber` parameter.**

Since processors receive their own events (5.1), there is no subscriber to exclude from the backpressure check. `waitForConsumers` simply filters on `isConsuming()`. The source processor's channel has `isConsuming = false` (it just yielded, so consume() returned), so it's naturally skipped.

**5.7 Drain signal fires AFTER processor resumes from yield, not on dequeue.**

In `streamEvents()`: `removeFirst()` dequeues the event, `yield event` suspends until the processor finishes, then `drainDeferrer.wakeUpNext()` fires. This means drain = "processor has fully processed the event and resumed." One drain → one `waitForDrain` waiter wakes → one producer unblocked. Tight 1:1 backpressure.

**5.8 `drainDeferrer.wakeUpNext()` (not wakeUpAll) in streamEvents.**

One event consumed → one producer unblocked. This maintains tight backpressure. Multiple producers sleeping on the same channel's `waitForDrain` are woken one at a time, each corresponding to one consumed event. `wakeUpAll` is only used in `close()` during shutdown.

**5.9 Replay only runs through the store — processors do not participate.**

During `hydrateStore()`, events are read from the ledger and dispatched to the store reducer. Processors are not mounted yet. Cascading events from reducers are NOT re-emitted during replay (they're already in the ledger). Processors only start receiving events after boot.

---

### 6. REMAINING MINOR ITEMS

- `BlockingSubscriberOptions` in `src/core/event-channel.ts` line 8 should be renamed to `EventChannelOptions`.

---

### 7. MULTIPLEXER STRATEGY LANDSCAPE

Currently implemented:
- **BlockingMultiplexer** — Production at rate of slowest consuming processor. No configuration needed. No buffer size, no overflow strategy.

Planned (not yet implemented):
- **FailFirstMultiplexer** (name TBD) — Same `EventChannel`. Different `broadcast()`: checks subscriber queue sizes against a threshold, throws/cancels if any consumer falls too far behind. Fail-fast detection of broken/stuck consumers.
- **Throttle/Unbounded multiplexer** (name TBD) — Same `EventChannel`. `broadcast()` enqueues and returns immediately, no backpressure. Producer runs at full speed. Consumers process at their own pace.

All multiplexer implementations share `EventChannel` as the subscriber. The strategy is entirely in `broadcast()`.

---

### 8. FILE LAYOUT (CORE)

```
src/
  core/
    event-channel.ts              — EventChannel (universal subscriber)
    multiplexer/
      blocking-multiplexer.ts     — BlockingMultiplexer
    intent-processor.ts           — IntentProcessor (processor lifecycle)
    ductus-kernel.ts              — DuctusKernel (orchestrator)
    default-event-sequencer.ts    — DefaultEventSequencer
    ductus-store.ts               — DuctusStore
    mutex.ts                      — Mutex
    default-deferrer.ts           — DefaultDeferrer
    default-event-listener.ts     — DefaultEventListener
    linked-list.ts                — LinkedList
    events.ts                     — BootEvent definition
    intents.ts                    — RequestIntent, ResponseIntent
  interfaces/
    event.ts                      — BaseEvent, CommittedEvent, EventDefinition, Volatility
    event-subscriber.ts           — EventSubscriber (unified interface)
    multiplexer.ts                — Multiplexer, BroadcastingContext
    event-sequencer.ts            — EventSequencer, CommitContext, CommitEventData
    event-ledger.ts               — EventLedger
    store-adapter.ts              — StoreAdapter, Reducer
    cancellation-token.ts         — CancellationToken, Disposer
    deferrer.ts                   — Deferrer
    event-listener.ts             — EventListener
    event-processor.ts            — EventProcessor (alias for ProcessorEntity)
  ledger/
    jsonl-ledger.ts               — JsonlLedger
  system/
    canceller.ts                  — Canceller
  factories.ts                    — Public API: Ductus.event(), Ductus.processor(), Ductus.kernel(), etc.
  index.ts                        — Barrel exports
```

---

### 9. PUBLIC API SURFACE (via `factories.ts`)

Users interact with Ductus via the default export:

- `Ductus.event(name, schema)` — define a durable event
- `Ductus.signal(name)` — define a volatile event (no payload)
- `Ductus.processor(name, asyncGeneratorFn)` — define a processor
- `Ductus.reducer()` — start building a reducer
- `Ductus.flow()` — start building a flow (initialState + reducer + processors + reactions + agents)
- `Ductus.kernel({ flow, multiplexer, sequencer, ledger, ... })` — create and configure a kernel
- `Ductus.BootEvent` — the boot event definition (for `BootEvent.is(event)` checks)
- Schema helpers: `Ductus.string()`, `Ductus.number()`, `Ductus.boolean()`, `Ductus.object()`, `Ductus.array()`, etc.

Kernel lifecycle: `kernel.boot()` → `kernel.monitor()` (await all processors) → `kernel.shutdown()`.

The multiplexer and sequencer are passed in by the user — they are not created by the factory. This allows swapping strategies.
