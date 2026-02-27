# Task: 013-agent-role-contracts

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Type Extensibility)
- `rfc-001.revision-06.md` (Section 3.1 The Agent Interface, 3.2 Defined Roles)

## 1. Objective & Responsibility
Implement the pure, stateless `AgentRole` interface and construct the concrete implementation classes for the `PlannerAgent` and `EngineerAgent`. These classes define the exact Persona, the allowed capabilities (Tools), and the exact output shapes the LLM is expected to render. They are purely logical constructs—they do not interact with the network or the hub.

## 2. Invariants & Global Contracts (The Happy Path)
- **Stateless Guarantee:** An `AgentRole` MUST never hold conversation history, token counters, or context streams natively in its class state (`this.history = []` is strictly forbidden). It must only expose pure functions that operate on context arrays passed into them. They are pure data transformers mimicking standard strategy patterns.
- **The Parsing Contract:** The Role defines the specific `z.infer` structure it requires from the LLM. The `.parse(rawLlmString)` method must cleanly extract JSON/Markdown and validate it against the Role's specific Zod schema.

## 3. I/O Boundaries & Dependencies
- **No I/O Allowable:** Absolutely no `fs`, network fetches, LLM API tokens, or Hub event emission.

## 4. Exact Event Signatures (Contract Adherence)
- *N/A (Pure Types and Stateless Classes)*.

## 5. Lifecycle & Unhappy Path
- **Hallucination Rejection (The Unhappy Path):** The LLM will send back malformed JSON, markdown wrap text ignoring the spec, or refuse the prompt. The `parse()` method MUST throw a strictly typed Error (e.g. `AgentParseError`) capturing the malformed string. The `AgentProcessor`/`Dispatcher` sitting above this generic class relies on that specific thrown error to increment hallucination counters and trigger retry loops.

## 6. Required Execution Constraints
- Define the `AgentRole` Interface:
  - `name`: string (e.g., `'planner'`)
  - `systemPrompt`: string (static base persona)
  - `allowedTools`: array of strings (e.g., `['fs_read', 'git_diff']`)
  - `parse(response: string)`: Returns strictly typed `TOutput` or throws Validation Error.

## 7. Definition of Done
1. **The Stateless Proof:** Run `tsc` and ensure there are no class instance properties managing arrays or state in the `PlannerRole` implementation.
2. **The Formatting Recovery Proof:** Write an `EngineerRole.parse()` test. Feed it a string containing ````json { "files": ["a.ts"] } ````. Assert the method successfully uses Regex to strip the markdown wrapping and correctly validates and returns the literal object `{ "files": ["a.ts"] }`. Feed it raw text "I'm sorry, I can't do that". Assert it forcefully throws `AgentParseError`.
