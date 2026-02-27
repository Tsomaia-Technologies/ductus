# Task: 004-persistence-processor

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for DI Constructor and Immutability rules)
- `rfc-001.revision-06.md` (Section 3.3 Event Volatility, 2.1 The Ledger)

## 1. Objective & Responsibility
Implement the `PersistenceProcessor`, which acts as the Ledger (Long-Term Memory) of the Nervous System. It listens to the `MultiplexerHub` and securely flushes historical facts to physical disk using the `FileAdapter`. It acts exclusively as an *Event Sink* and yields no outgoing events.

## 2. Invariants & Global Contracts (The Happy Path)
- **Volatility Filter:** The most critical invariant. The Ledger MUST remain pristine. If an incoming event has `volatility` set to `'volatile'` or `'volatile-draft'`, this processor MUST silently ignore it. Only events marked `'durable'` may be written to disk.
- **Append Only (JSONL):** The file format is strictly JSON Lines. Each line is a single `JSON.stringify(event)` followed immediately by `\n`. The ledger is mathematically append-only; it is never rewritten during live operation.

## 3. I/O Boundaries & Dependencies
- **Adapter Injection:** You must inject `FileAdapter` into the constructor. You are strictly forbidden from writing `fs.appendFileSync` or touching the OS.
- **Path Resolution:** The absolute file path to the `ledger.jsonl` file must be injected securely via the constructor during Bootstrapper assembly.

## 4. Exact Event Signatures (Contract Adherence)
- **Listens to:** Every `CommitedEvent<any>` yielded by the Hub.
- **Yields:** None. (This an Event Sink).

## 5. Lifecycle & Unhappy Path
- **Hydration (Muted Mode):** If an incoming event has the `isReplay: true` flag, the `PersistenceProcessor` MUST instantly drop it. The event is already in the ledger; re-appending it during startup hydration would cause infinite exponential ledger bloating.
- **File System Failures:** If `FileAdapter.append()` throws an error (e.g., out of disk space), the processor MUST let the unhandled rejection bubble up to strictly crash the Node Engine according to the Fail-Fast architecture. Do not swallow disk I/O errors.

## 6. Required Execution Constraints
- Do not build internal event buffering logic unless performance demands it. Await the `FileAdapter.append` operation sequentially for each durable event to guarantee chronological safety on disk.

## 7. Definition of Done
1. **The Volatility Proof:** Mock a `FileAdapter`. Feed the processor an array of 5 `CommitedEvent`s (3 marked `durable`, 2 marked `volatile`). Await the stream flush. Assert that the mock `FileAdapter.append` was called exactly 3 times.
2. **The Replay Amnesia Proof:** Feed the processor a `durable` event that also contains `isReplay: true`. Assert that `FileAdapter.append` is called 0 times.
