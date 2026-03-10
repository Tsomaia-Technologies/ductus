# R24 — Add Volatile Event Support to Sequencer/Multiplexer

**Severity:** HIGH
**Audit ref:** C2/R02 dependency
**Depends on:** None
**Blocks:** R02

---

## Problem

Observation events have a `volatility` property (RFC Section 11.2). Volatile events should be broadcast to subscribers but NOT persisted to the ledger. The current sequencer/multiplexer pipeline always commits every event to the store/ledger. There is no concept of volatile events in the core commit path.

---

## 1. Exploration

- `src/core/default-event-sequencer.ts` — `commit()` method
- `src/core/multiplexer/*.ts` — `broadcast()` methods
- `src/core/intent-processor.ts` — how events flow from processors to the sequencer
- `src/interfaces/event.ts` — `BaseEvent` fields

Determine: where is the right place to skip ledger persistence for volatile events?

---

## 2. Implementation

### 2.1 Add volatility field to BaseEvent (if missing)

If `BaseEvent` doesn't already have a `volatility` field, add:
```typescript
volatility?: 'volatile' | 'durable'
```

### 2.2 Skip store persistence for volatile events

In `DefaultEventSequencer.commit()` or in the multiplexer, check:
```typescript
if (event.volatility !== 'volatile') {
  await this.store.append(committedEvent)
  this.ledger.push(committedEvent)
}
```

Volatile events still need:
- A `sequenceNumber` (for ordering)
- To be broadcast to subscribers
- A `hash` chain entry? (Decision: probably not — volatile events should not participate in the hash chain)

### 2.3 Decision: hash chain participation

**Option A:** Volatile events get a sequence number but no hash chain participation. `prevHash` is left as the last durable event's hash.
**Option B:** Volatile events participate in the hash chain (breaking the chain for any consumer that only sees durable events).

**Recommendation:** Option A — volatile events are skipped in the hash chain.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Test: emit a volatile event, verify it reaches subscribers but is not in the store
- Test: emit volatile then durable, verify hash chain integrity (durable event's `prevHash` links to last durable event, not the volatile one)
- Run existing tests (no regression — all current events are implicitly durable)

---

## 4. Self-Review

- [ ] Volatile events reach subscribers
- [ ] Volatile events are not stored/persisted
- [ ] Hash chain integrity is maintained for durable events
- [ ] Sequence numbers are assigned to all events (volatile and durable)
- [ ] No regression for existing events (all default to durable)

---

## 6. Manual Review Request

Highlight:
1. Should volatile events participate in the hash chain?
2. Should volatile events receive committed event metadata (eventId, timestamp)?
3. How do volatile events interact with the reducer?
