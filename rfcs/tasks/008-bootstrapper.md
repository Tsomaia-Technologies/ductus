# Task: 008-bootstrapper

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Manual Dependency Injection rules)
- `rfc-001.revision-06.md` (Section 8.4 Bootstrapping Algorithm / Hydration)

## 1. Objective & Responsibility
Implement the critical `Bootstrapper` class and `ignite()` mechanism. This is the entry point that literally builds the engine. It manually wires the Hub to the true OS Adapters and the 10 Processors. Most critically, it handles **Replay Hydration** from the JSONL ledger, and performs the coordinated flip from `SilentMode` to `LiveMode` before yielding execution control back to the Node event loop.

## 2. Invariants & Global Contracts (The Happy Path)
- **The Single Source of DI Truth:** This is the *only* file in the entire @ductus codebase allowed to instantiate a concrete adapter like `NodeFsAdapter` or `CliTerminalAdapter`. Processors are never allowed to instantiate an adapter, they only accept the interface via `constructor`.
- **The Hydration Sequence:** The Bootstrapper must uphold a strict, 4-step sequence to rebuild deterministic state without triggering side effects.
    1. Wire all processing objects entirely.
    2. Set `Hub.mode = 'SilentMode'`.
    3. Stream parse the JSONL history file, executing `.broadcast()` for every line onto the Hub.
    4. Set `Hub.mode = 'LiveMode'`.

## 3. I/O Boundaries & Dependencies
- **Full Physical Access:** The Bootstrapper requires deep integration. It imports the concrete implementations of `FileAdapter`, `OSAdapter`, and `TerminalAdapter`.
- **The Ledger File:** It takes the current working directory path from the CLI command and resolves the absolute path to `ledger.jsonl`.

## 4. Exact Event Signatures (Contract Adherence)
- **Yields (Control):** `SYSTEM_START` (After hydration completes and LiveMode begins).

## 5. Lifecycle & Unhappy Path
- **JSONL Parsing Error:** If the Ledger file is mathematically corrupted (e.g., an interrupted write resulting in half a JSON string), the Bootstrapper MUST catch the `JSON.parse` error. It MUST inform the `TerminalAdapter` of the catastrophic corruption and `process.exit(1)` before attempting to hydrate partial state.
- **Genesis Run:** If `ledger.jsonl` does not exist, the Bootstrapper handles this natively. `Hub.mode = 'LiveMode'` is engaged instantly, and `SYSTEM_START` is fired.

## 6. Required Execution Constraints
- Do not use global singletons for the Hub or the Config. Pass the instances directly into the constructors of the processors.
- The `hydrateLedger` method MUST use an async readline interface to stream the JSONL file line-by-line. Given a 200MB JSONL file, `fs.readFileSync` will cause memory pressure V8 death.

## 7. Definition of Done
1. **The DI Wiring Proof:** Write a basic compile-time test ensuring the `Bootstrapper` class successfully imports and chains all 10 Processors into the `Hub.register` method without TypeScript errors.
2. **The Muted Hydration Proof:** Provide a mock `ledger.jsonl` array containing 5 events. Inject a mock `LoggerProcessor`. Assert that during `Bootstrapper.ignite()`, the `LoggerProcessor` does not print any of the 5 historical events, proving `SilentMode` was correctly toggled on and off.
