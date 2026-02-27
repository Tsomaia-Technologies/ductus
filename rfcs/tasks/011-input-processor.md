# Task: 011-input-processor

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Headless I/O Separation)
- `rfc-001.revision-06.md` (Section 6.1 InputProcessor Architecture)

## 1. Objective & Responsibility
Implement the `InputProcessor` (Sensory Cortex). It processes situations where the pure State Machine halts because human decisions, approvals, or missing context are required. If the State Machine yields `REQUEST_INPUT`, this processor queries the human string using the `TerminalAdapter` facade.

## 2. Invariants & Global Contracts (The Happy Path)
- **Zero Raw Prompts:** No direct CLI dependencies (`readline`, `inquirer`, `clack`) can exist here. You MUST route interaction through `TerminalAdapter.ask()` and `TerminalAdapter.confirm()`.
- **Zod Enforcement:** A fundamental system guarantee is that raw human string input must be cast into strictly typed JSON structures before re-entering the Hub spine. The `TerminalAdapter` accepts a `ZodSchema`. This processor is responsible for passing the correct schema derived from the incoming event.

## 3. I/O Boundaries & Dependencies
- **Constructor Injection:** You MUST inject `TerminalAdapter` via the constructor. 
- **Zod Schema Origin:** The configuration or `REQUEST_INPUT` event payload must define the expected schema (e.g. string vs boolean).

## 4. Exact Event Signatures (Contract Adherence)
- **Listens To:** `REQUEST_INPUT` (Payload contains `id`, `question` string, and `expectedSchemaType`).
- **Yields (Durable):** `INPUT_RECEIVED` (Payload contains `{ id, answer }`. The answer MUST be the `z.infer<T>` extracted from the adapter's successful resolution).

## 5. Lifecycle & Unhappy Path
- **Hydration Bypass:** If `event.isReplay === true`, you MUST instantly drop the event. The human answered this question days ago; the answer is already en route in the replay stream. Do NOT block hydration waiting for phantom user input.
- **Interruption Acknowledgment:** If `CIRCUIT_INTERRUPTED` happens while a `TerminalAdapter.ask()` promise is floating/pending, the user has likely Ctrl+C'd out of the prompt. Do NOT catch and attempt to yield a malformed `INPUT_RECEIVED`. Allow the adapter and Node process to naturally terminate.

## 6. Required Execution Constraints
- Map incoming `REQUEST_INPUT` schema types (string identifiers in the payload) to actual physical Zod schema objects (e.g., `z.string()`, `z.boolean()`).
- The `process` method must `await` the human response before yielding down the stream. This naturally creates backpressure blocking the State Machine until the human fulfills the request, which is exactly the intended behavior.

## 7. Definition of Done
1. **The Hydration Filter Test:** Mock the `TerminalAdapter`. Yield a `REQUEST_INPUT` event with `isReplay: true`. Assert that the `TerminalAdapter.ask` mock is called 0 times.
2. **The Type Safety Test:** Yield a request demanding a `boolean` expected schema. Mock the `TerminalAdapter` returning the primitive `true`. Assert the Processor yields an `INPUT_RECEIVED` where `payload.answer === true`.
