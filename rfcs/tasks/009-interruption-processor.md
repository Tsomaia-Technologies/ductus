# Task: 009-interruption-processor

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Event Stream rules)
- `rfc-001.revision-06.md` (Section 6.2 Interruption: The Panic Reflex)

## 1. Objective & Responsibility
Implement the `InterruptionProcessor` (The Brainstem). This component acts as the emergency kill switch for the entire architecture. It listens exclusively for Node.js system-level interrupts (like the human hitting Ctrl+C / `SIGINT`). Its sole responsibility is immediately injecting a global panic event into the Hub, commanding all processors to safely freeze.

## 2. Invariants & Global Contracts (The Happy Path)
- **The Panic Invariant:** Normal SIGINT simply terminates the Node process abruptly, instantly causing corrupted Ledger writes and Zombie child processes. This processor intercepts that signal, yields a deterministic `CIRCUIT_INTERRUPTED` event to give the Tool/Persistence processors 200ms to synchronously flush their streams and kill children, before forcing the exit.
- **The Double Tap:** If a user is frustrated and hits Ctrl+C *twice*, it means the graceful teardown is hanging. The processor MUST honor the user's second SIGINT by bypassing the event stream and invoking hostile termination (`process.exit(1)`).

## 3. I/O Boundaries & Dependencies
- **System Signal Access:** This processor connects directly to the Node global `process` object. No adapters are utilized for this raw system boundary.
- **The Hub Binding:** Requires the `MultiplexerHub` via constructor to yield the emergency event.

## 4. Exact Event Signatures (Contract Adherence)
- **Listens To (Node):** `process.on('SIGINT')`, `process.on('SIGTERM')`.
- **Yields (Durable):** `CIRCUIT_INTERRUPTED` (Must include the signal string in the payload. Must have `volatility: 'durable-draft'`).

## 5. Lifecycle & Unhappy Path
- **Silent Mode Avoidance:** Even if the Hub is somehow in `SilentMode` (e.g., Hydration), if a human hits Ctrl+C, the InterruptionProcessor must still force the broadcast through. 
- **Grace Period Timeout:** After yielding `CIRCUIT_INTERRUPTED`, it must instantiate a 1000ms hard stop timeout (e.g., `setTimeout(() => process.exit(1), 1000)`). If the system gracefully halts on its own before that, great. If not, forcefully terminate to guarantee the CLI never "hangs".

## 6. Required Execution Constraints
- Maintain an internal `stopCount` tracking integer.
- The processor must bind the event listeners securely in its constructor. It must expose a `detach()` or `destroy()` method to forcefully `process.removeListener()` for clean unit testing and test runner closures.

## 7. Definition of Done
1. **The Double Tap Proof:** Manually invoke your `handleSigint` callback method. Assert that the `CIRCUIT_INTERRUPTED` event was yielded. Invoke it exactly one more time. Assert that `process.exit(1)` was triggered instantly bypassing the Hub.
2. **The Grace Period Proof:** Invoke `handleSigint` once. Assert that the 1000ms fallback timeout was scheduled via Jest's mocked timer system, guaranteeing the process won't hang.
