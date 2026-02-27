# Task: 015-agent-processor (The Gateway)

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Constructor DI and Fail-Fast rules)
- `rfc-001.revision-06.md` (Sections 2.1, 4.3 Verifiable Caching, 6.2 Interruption, 9.0 Config)

## 1. Objective & Responsibility
Implement the `AgentProcessor`. This is the **ONLY** component in the 10-processor Circuit allowed to initiate LLM requests. It acts as the physical bridge between the pure event Circuit and the asynchronous AI Network layer (`AgentDispatcher`). 

When the StateMachine yields an `EFFECT_SPAWN_AGENT`, this processor resolves the configured Role, renders the requested system prompt via the `.mx` template, dispatches the network call, streams the tokens back to the UI, and captures the final durable entity.

## 2. System Invariants (Caching & Determinism)
- **Verifiable Caching (Zero-Cost Replay):** The Hub stamps every incoming event with a cryptographic `hash` (Section 4.3). The `AgentProcessor` MUST use this exact `hash` as the global cache key. Before invoking the underlying `AgentDispatcher`, you must attempt a `GET` on the local cache using this hash. If it exists, you immediately yield the cached result without touching the LLM or waiting for a network response.

## 3. I/O Boundaries & Dependencies
- **Constructor Injection:** You must receive the resolved `DuctusConfig` and `AgentDispatcher`.
- **Template I/O Boundary:** The `ductus.config.ts` references `.mx` Moxite template paths. You are strictly responsible for physical I/O here: you must use the injected `FileAdapter` to read the `.mx` file from disk into memory. You then pass that raw string and task context into the `moxite.render()` method to generate the final system prompt. The Dispatcher does *not* know how to read files.
- **Cache Adapter:** A standard async Key-Value cache interface must be injected for the Verifiable Caching invariant.

## 4. Exact Event Signatures (Contract Adherence)
- **Listens To:** `EFFECT_SPAWN_AGENT` (Must include `roleName` and `scope` in payload).
- **Listens To (Control):** `CIRCUIT_INTERRUPTED`.
- **Yields (Volatile):** `AGENT_TOKEN_STREAM` (must be `volatility: 'volatile-draft'`).
- **Yields (Durable):** `AGENT_REPORT_RECEIVED` or `AGENT_FAILURE`.

## 5. Lifecycle & Unhappy Path
- **Muted Mode (Hydration):** If `event.isReplay === true`, you MUST instantly return/ignore it. Do not attempt to hit the cache, do not read `.mx` files, and certainly do not hit the Anthropic API. The historical LLM outcome is already approaching in the stream.
- **Global Panic:** The processor must track all active `AgentDispatcher` invocations using Javascript `AbortController`s mapped by `event.id`. If a `CIRCUIT_INTERRUPTED` event arrives, the processor MUST immediately `abort()` every active controller, ensuring all live network streams are ruthlessly snapped. It must gracefully swallow the resulting `AbortError`s and yield nothing.

## 6. Required Execution Constraints
- Map incoming `EFFECT_SPAWN_AGENT` target roles (e.g., `'engineer'`) to the pre-built `AgentRole` classes mapped in Task 013.
- Iterate the `AsyncIterable` returned by the Dispatcher. Ensure that chunks tagged `token` are aggressively re-wrapped in `AGENT_TOKEN_STREAM` events and flagged as volatile. The final chunk tagged `complete` must be extracted, written to the Cache, and yielded as the durable `AGENT_REPORT_RECEIVED`.

## 7. Definition of Done
1. **The Hash Cache Proof:** Yield an `EFFECT_SPAWN_AGENT` event with a mock `hash` of "X123". Pre-load the Cache mock with `{"X123": { files: ["hi.ts"] }}`. Assert the processor yields an immediate `AGENT_REPORT_RECEIVED` and strictly never calls `FileAdapter` or `AgentDispatcher`.
2. **The Panic Sequence Proof:** Simulate a slow-drip `AsyncIterable` from the Dispatcher. Yield an `EFFECT_SPAWN_AGENT` to start the stream. After 1 token yields, yield `CIRCUIT_INTERRUPTED` to the hub. Assert that the `AbortController` throws internally, the overall processor function gracefully exits without crashing Node, and NO `durable` events are emitted.
