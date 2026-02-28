# Task: 002-multiplexer-hub

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Zero-Allocation rule and Immutability)
- `rfc-001.revision-06.md` (Section 2.1, 4.1 Hash-Chained Ledger)

## 1. Objective & Responsibility
Implement the `MultiplexerHub`. This is the concurrent spine of the digital organism. It receives `BaseEvent`s, stamps them into `CommitedEvent`s (calculating sequence and SHA-256 hash), physically locks the payload, and broadcasts them concurrently to all attached `EventProcessor`s.

## 2. Invariants & Global Contracts (The Happy Path)
- **Zero-Allocation Broadcast:** You MUST use standard `for` loops for the fan-out broadcasting. Do not use `.map()`, `.filter()`, or `.forEach()`.
- **Absolute Immutability:** You MUST call `Object.freeze()` on the event payload *before* dispatching it to processors. This prevents rogue processors from silently tearing the state logic.
- **Cryptographic Chaining:** Real `hash` logic requires appending the `prevHash` + `authorId` + `sequenceNumber` + stringified payload.

## 3. I/O Boundaries & Dependencies
- **No Outside Type:** The Hub holds no I/O adapters. You MUST use native `node:crypto` (`createHash('sha256')`) for hashing. No third-party crypto libs.

## 4. Exact Event Signatures (Contract Adherence)
- **Input:** Accepts `BaseEvent` variants from connected Processors.
- **Output:** Yields immutable `CommitedEvent` variants to the internal `AsyncIterable` queues of all registered Processors.

## 5. Lifecycle & Unhappy Path
- **Muted Mode Toggle:** The Hub must expose a mechanism (`mode: 'LiveMode' | 'SilentMode'`) that the Bootstrapper controls. When transitioning to `SilentMode`, the Hub MUST attach an `isReplay: true` flag to every newly stamped `CommitedEvent` to inform intelligent processors (like Tools/Agents) not to perform side effects.

## 6. Required Execution Constraints
- Manage a private array of registered `EventProcessor` instances.
- Track internal `sequence` (integer) and `lastHash` (string, initializing as 'genesis').
- The `broadcast` method must be `async` but must NOT `await` the completion of consumer processors. It is strictly a fire-and-forget fan-out queue pusher.

## 7. Definition of Done
1. **The Immutability Test:** Write a test simulating a rogue processor trying to `delete event.payload.id`. Assert that JavaScript strict-mode throws a `TypeError`.
2. **The Crypto Proof:** Broadcast two identical `BaseEvent`s consecutively. Assert that their resulting `CommitedEvent.hash` strings are completely different because the `prevHash` and `sequenceNumber` evolved in the chain.
