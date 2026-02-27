# Task: 014-agent-dispatcher

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Token Limits)
- `rfc-001.revision-06.md` (Section 2.1 The Gateway, Section 9.0 Roles config)

## 1. Objective & Responsibility
Implement the `AgentDispatcher`. It is the heavy-lifting, physical Network Execution Engine that wraps the official provider SDKs (Anthropic/OpenAI). It accepts an `AgentRole` logic block, an array of historical context messages, and dynamically negotiates the streaming request to the external AI provider while strictly obeying token management rules.

## 2. Invariants & Global Contracts (The Happy Path)
- **The Truncation Invariant:** It is mathematically guaranteed that over a 3-hour session, the event ledger context will exceed 200,000 tokens. The Dispatcher MUST calculate the accumulated tokens of `(SystemPrompt + InputPrompt + ContextHistory)`. If the sum exceeds the active model's `maxTokens`, the Dispatcher MUST forcefully splice (drop) the oldest contextual messages until the payload fits, before executing the API call.

## 3. I/O Boundaries & Dependencies
- **Physical Network:** You MUST inject physical HTTP clients or official SDK instances (e.g., `@anthropic-ai/sdk`) via the constructor.
- **Abort Capabilities:** The Dispatcher MUST accept a standard JS `AbortSignal` parameter for all `process()` requests. If the signal fires, the internal HTTP `.stream()` must be instantly ripped down to save bandwidth/costs.

## 4. Exact Event Signatures (Contract Adherence)
- *N/A (Operates internally behind the AgentProcessor. Returns AsyncIterables of raw Token/Complete objects, not Hub Events).*

## 5. Lifecycle & Unhappy Path
- **Provider Fallbacks:** If the primary Anthropic endpoint returns an HTTP 529 Overloaded or 429 Rate Limited, the Dispatcher MUST reference the injected `strategies` array from the `ductus.config.ts`. It must transparently failover to the secondary model defined in the array without crashing the process.
- **Global Panic Support:** If the supplied `AbortSignal` triggers during active streaming, the Dispatcher must cleanly exit the async iterator yielding without throwing a catastrophic fatal Node error. It must swallow expected `AbortError`s and ignore partial buffers.

## 6. Required Execution Constraints
- Use an `AsyncIterableIterator<{ type: 'token' | 'complete', content?: string, parsedOutput?: T }>` to securely yield the `token` stream upward, and end the stream with exactly one `complete` payload containing the data parsed successfully by the provided `AgentRole`.
- Implement a distinct Retry Loop wrapper. If the LLM throws an internal API 500 error, wait 2000ms and try exactly `X` more times based on configuration limits before yielding a definitive `AgentFailure`.

## 7. Definition of Done
1. **The Truncation Algorithm Proof:** Create a mock function `countTokens(string)` that always returns `100`. Inject an `AgentContext` containing 5 historical messages. Set the active model's max limit to `350`. Assert that the `AgentDispatcher` drops exactly the oldest 2 messages before hitting the mock LLM API interface, ensuring `(500 tokens -> 300 tokens) < 350`.
2. **The Panic Abort Proof:** Mount an active token stream using a mocked slow-drip API layer. Externally trigger the `.abort()` on the `AbortSignal` passed into `process()`. Assert that the async generator cleanly closes within 50ms and the `HTTP` wrapper receives the abort command.
