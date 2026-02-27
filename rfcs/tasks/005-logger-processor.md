# Task: 005-logger-processor

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for DI Constructor Dependency Injection)
- `rfc-001.revision-06.md` (Section 3.3 Event Volatility, 2.1 Logger)

## 1. Objective & Responsibility
Implement the `LoggerProcessor` (Broca's Area). It listens to the Hub stream and translates raw internal state events into clean, human-readable terminal output. It is the direct inverse of the Persistence processor: it cares heavily about `volatile` UI noise like LLM streaming tokens and progress bars.

## 2. Invariants & Global Contracts (The Happy Path)
- **The Formatting Contract:** The Hub yields raw, unstyled JSON payloads. The `LoggerProcessor` is strictly responsible for all aesthetic text formatting (e.g., determining that an `AGENT_FAILURE` event should be printed in red text). The core logic MUST NEVER contain ANSI escape codes.

## 3. I/O Boundaries & Dependencies
- **Adapter Injection:** You MUST inject the `TerminalAdapter` via the constructor. 
- **No Console:** You are strictly forbidden from placing `console.log`, `process.stdout.write`, or any direct output mechanism anywhere in this class. All strings must be passed to `TerminalAdapter.log()`.

## 4. Exact Event Signatures (Contract Adherence)
- **Listens to:** Every `CommitedEvent<any>` yielded by the Hub.
- **Yields:** None. (This an Event Sink).

## 5. Lifecycle & Unhappy Path
- **Hydration (Silent Mode):** When the Bootstrapper is hydrating the state from a 10,000-line JSONL file, it will attach `isReplay: true` to the events. The `LoggerProcessor` MUST silently drop all events marked `isReplay: true`. Failure to do so will result in the terminal uselessly vomiting thousands of lines of past history in one second during boot.
- **Global Panic:** If `CIRCUIT_INTERRUPTED` or `EMERGENCY_STOP` is received, immediately print a severely formatted red abort message to the terminal.

## 6. Required Execution Constraints
- Implement a `switch` or cleanly mapped routing object to match event `type` strings (e.g., `AGENT_TOKEN_STREAM`, `TOOL_COMPLETED`) to private formatting methods.
- For `AGENT_TOKEN_STREAM`, ensure tokens are printed contiguously (no trailing newlines) until a formatting boundary dictates otherwise.

## 7. Definition of Done
1. **The Silence Proof:** Provide a mock `TerminalAdapter`. Feed the processor 5 durable events where `isReplay === true`. Assert that `TerminalAdapter.log` was invoked 0 times.
2. **The Output Routing Proof:** Feed the processor an `AGENT_TOKEN_STREAM` volatile event. Assert that the `TerminalAdapter.log` is invoked with the exact text chunk extracted from the payload.
