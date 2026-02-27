# Task: 012-session-processor

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Event Pipeline constraints)
- `rfc-001.revision-06.md` (Section 2.1 The Librarian)

## 1. Objective & Responsibility
Implement the `SessionProcessor` (The Librarian). Its sole purpose is context genesis. When the initial spark event (`SYSTEM_START`) is fired, this processor scans the active workspace, loads the `ductus.config.ts`, attempts to locate previous session checkpoints, and yields the initial unified `CONTEXT_LOADED` payload.

## 2. Invariants & Global Contracts (The Happy Path)
- **The True Beginning:** The State Machine Reducer relies *completely* on the output of this processor to initialize its internal logic tree. The `CONTEXT_LOADED` event must carry the definitive project configuration (`DuctusConfig`) and the starting state metadata (Genesis vs Continuation).

## 3. I/O Boundaries & Dependencies
- **Hardware Abstraction:** You must inject `FileAdapter`. You are strictly forbidden from writing `fs.existsSync`.
- **The Config Path:** The path to the `ductus.config.ts` must be injected via the Bootstrapper. You must use a deterministic loading algorithm (or `FileAdapter.read()`) to ingest the config and parse it via Zod.

## 4. Exact Event Signatures (Contract Adherence)
- **Listens To:** `SYSTEM_START`
- **Yields (Durable):** `CONTEXT_LOADED` (Payload must include the validated `config` object, and a boolean `isGenesis` flag indicating if previous state checkpoints were found).

## 5. Lifecycle & Unhappy Path
- **Malformed Configuration:** If the user's `ductus.config.ts` exists but fails Zod validation (e.g. missing required strategy properties), you MUST catch the Zod error and yield `SYSTEM_ABORT_REQUESTED` detailing the configuration syntax error. Do NOT limp forward with half a config tree.
- **Muted Mode Protection:** This component generally only operates on the actual live `SYSTEM_START` triggered by the Bootstrapper *after* hydration finishes. If for some reason a `SYSTEM_START` with `isReplay: true` appears, ignore it.

## 6. Required Execution Constraints
- Do not build complex "project scanning" logic beyond checking for the existence of the `ductus.config.ts` and the `ledger.jsonl`.
- If the configuration file does not exist, provide a graceful fallback warning UI/event, or load hardcoded library defaults. (Consult with implementation specs if defaults are permitted, otherwise assume strictly required).

## 7. Definition of Done
1. **The Config Crash Proof:** Inject a mock `FileAdapter` that returns a deliberately malformed JSON string (missing `roles` property) when asked for the configuration. Yield `SYSTEM_START`. Assert the processor yields `SYSTEM_ABORT_REQUESTED` pinpointing the exact Zod parsing failure.
2. **The Genesis Path:** Mock the `FileAdapter` to return false on file existence checks. Assert that the `CONTEXT_LOADED` event yielded contains `{ isGenesis: true }`.
