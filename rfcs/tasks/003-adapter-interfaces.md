# Task: 003-adapter-interfaces

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Interface-First Rule)
- `rfc-001.revision-06.md` (Section 6.1 Headless-First)

## 1. Objective & Responsibility
Establish the headless abstraction boundaries (`OSAdapter`, `FileAdapter`, and `TerminalAdapter`) as pure TypeScript `interfaces`. These contracts completely isolate our pure state machinery from physical Node.js side-effects (file systems, standard input, child processes).

## 2. Invariants & Global Contracts (The Happy Path)
- **Headless Guarantee:** Processors and the Hub are strictly forbidden from importing `fs`, `child_process`, `readline`, or `inquirer`. They MUST rely on these exact adapter injected contracts.

## 3. I/O Boundaries & Dependencies
- **Zod Dependency:** The `TerminalAdapter` interface MUST explicitly demand a `ZodSchema` parameter for its `.ask()` method to enforce type-safety on raw user string input.

## 4. Exact Event Signatures (Contract Adherence)
- *N/A (Pure interfaces)*

## 5. Lifecycle & Unhappy Path
- **Timeouts:** The `OSAdapter` contract MUST explicitly demand a `timeoutMs` option parameter. The system relies on this interface parameter to prevent "Zombie Tools."

## 6. Required Execution Constraints
Define the following interfaces strictly:
- `OSAdapter.exec`: Takes command, args, and options (cwd, timeoutMs). Returns a Promise of stdout, stderr, exitCode.
- `FileAdapter`: Exposes `append(path, data)` for the Ledger, `readStream()` for hydration, and `read()` for templates.
- `TerminalAdapter.ask`: Takes a string prompt and a `ZodSchema<T>`. Returns `Promise<T>`.
- `TerminalAdapter.log`: Fire-and-forget string printing.

## 7. Definition of Done
- No behavioral tests are required for a file containing only pure TypeScript `interface` exports. Verify that the file compiles cleanly and that `zod` types are correctly imported.
