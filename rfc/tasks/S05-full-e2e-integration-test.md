# S05 — Full Kernel-Booted End-to-End Integration Test

**Phase:** 4 (Verification)
**Depends on:** S02, S03, S04
**Blocks:** Nothing

---

## Why This Task Exists

The RFC audit found that Task 14 (integration tests) was only partially done. The existing tests call `invokeAgent()` directly or construct `AgentDispatcher` manually — they never boot a full `DuctusKernel` with reactions, multiplexer, sequencer, and ledger working together. The one "E2E" test (`v2-reaction-e2e.test.ts`) constructs a `createReactionAdapter` and manually drives it, bypassing the kernel entirely.

This matters because the kernel is the real orchestrator. It wires the multiplexer to broadcast committed events to processors, the sequencer to commit events atomically, and the store to reduce state. A test that bypasses the kernel might pass while the real runtime fails — because the wiring between components was never exercised.

**This task creates a test that boots a `DuctusKernel` using `Ductus.kernel()`, registers a flow with an agent that has a transport, triggers a domain event, and verifies that:**

1. The reaction pipeline invokes the agent through the transport
2. The agent's tool is executed by the framework
3. Observation events flow through the multiplexer
4. Domain events emitted by the reaction are committed to the store
5. The reducer processes the emitted events correctly
6. The kernel shuts down cleanly

This is the acid test for the entire agentic layer redesign. If this test passes, the system works end-to-end.

---

## 1. Exploration

Read:
- `src/factories.ts` — the `Ductus.kernel()` factory and all `Ductus.*` DSL methods
- `src/core/ductus-kernel.ts` — `DuctusKernel.boot()`, `monitor()`, `shutdown()`
- `src/utils/internals.ts` — `createReactionAdapter()` and `executePipeline()` (the final clean versions after S03)
- `src/__tests__/v2-reaction-e2e.test.ts` — the existing partial E2E test (learn what it covers and what it misses)
- `src/__tests__/agentic-integration.test.ts` — the existing unit-level agentic tests
- `sample2/tests/` — understand how sample2 integration tests boot the kernel

Understand the exact flow: `Ductus.kernel(options)` → `DuctusKernel` → `boot()` → processors mount → multiplexer broadcasts committed events → processor yields new events → sequencer commits → store reduces → multiplexer broadcasts again.

---

## 2. Implementation

### 2.1 Create `src/__tests__/kernel-e2e-agentic.test.ts`

This test file exercises the full stack:

**Test scenario: "A domain event triggers a reaction that invokes an agent with a tool, produces observation events, and emits domain events"**

Setup:
1. Define domain events: `TaskSubmitted` (durable), `TaskReviewed` (durable)
2. Define a tool: `RunTests` — accepts `{ files: string[] }`, returns `{ passed: boolean, output: string }`
3. Define a skill: `ReviewSkill` — input schema, output schema `{ approved: boolean, reason: string }`, with `.assert()` that validates the output
4. Define an agent: `ReviewerAgent` — with `ReviewSkill`, the `RunTests` tool, `.defaultModel()`, `.defaultTransport()`, `.observe({ observeAll: true })`
5. Create a mock `AgentTransport` that:
   - On first `send()`, yields a `tool-call` chunk requesting `RunTests` with specific args
   - On second `send()` (after tool result), yields `text` chunks with JSON matching the skill's output schema
   - Yields `usage` chunks with token counts
6. Define a reducer that counts `TaskReviewed` events
7. Define a reaction: `.when(TaskSubmitted).invoke({ agent, skill }).emit(TaskReviewed)`
8. Boot the kernel with `Ductus.kernel({ flow, multiplexer, sequencer, ledger, ... })`

Test assertions:
1. Boot the kernel, emit a `TaskSubmitted` event
2. Wait for the reaction pipeline to process
3. Verify the mock transport's `send()` was called (agent was invoked)
4. Verify the `RunTests` tool's execute function was called with correct args
5. Verify a `TaskReviewed` domain event was committed (check store state or ledger)
6. Verify observation events were committed (at least `AgentInvoked`, `ToolRequested`, `ToolCompleted`, `AgentCompleted`)
7. Verify the reducer processed `TaskReviewed` (state.count incremented)
8. Shut down the kernel cleanly

### 2.2 Additional test cases

Add at least these additional scenarios:

**Test: "Skill assertion failure triggers retry"**
- Configure skill with `.maxRetries(1)`
- First transport response fails assertion
- Second transport response passes
- Verify `SkillRetry` observation event was emitted
- Verify the agent was called twice

**Test: "Context policy is applied when token estimate exceeds limit"**
- Configure agent with `.maxContextTokens(100)` and `.contextPolicy('truncate')`
- Invoke the agent multiple times (emit multiple trigger events)
- After enough invocations, the conversation token estimate should exceed the limit
- Verify the conversation was truncated (transport receives fewer messages on subsequent call)

**Test: "Multiple agents in the same flow"**
- Register two agents with different skills
- Define two reactions triggered by different events
- Verify both agents are invoked through their respective transports

### 2.3 Test utilities

Create minimal test utilities if needed:
- `createMockTransport(responses: ...)` — factory for creating mock transports with scripted responses
- `createInMemoryLedger()` — if not already available, a simple in-memory ledger for tests

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- `npx jest` — ALL tests pass, including the new E2E tests
- The new E2E tests boot a real `DuctusKernel` — NOT just a dispatcher or reaction adapter
- The tests use `Ductus.kernel()` factory — NOT manual construction of internal classes
- At least 3 test scenarios cover: happy path with tools, skill retry, and multi-agent flow

---

## 4. Structural Constraints (reviewer MUST reject if violated)

- Test constructs `AgentDispatcher` directly → REJECT (must use `Ductus.kernel()`)
- Test calls `invokeAgent()` directly → REJECT (must go through the reaction pipeline triggered by events)
- Test manually calls `executePipeline()` → REJECT (must be triggered by the kernel processing events)
- Test has no assertion on observation events → REJECT (the whole point of the agentic layer is observability)
- Test does not shut down the kernel → REJECT (resource leak)

---

## 5. Report

- Test file created
- Number of test scenarios
- What each test covers (one sentence each)
- All test results
- Any issues discovered during E2E testing (this is the most likely place to find integration bugs)

---

## 6. Self-Review

- [ ] Tests boot a real `DuctusKernel` via `Ductus.kernel()`
- [ ] Tests register flows with agents, skills, tools, and transports using the DSL
- [ ] Tests trigger domain events and verify the full pipeline
- [ ] Tests verify tool execution by the framework
- [ ] Tests verify observation events flow through the multiplexer
- [ ] Tests verify domain events are committed and state is reduced
- [ ] Tests verify kernel shutdown closes transports
- [ ] Tests cover at least: tool loop, skill retry, and multi-agent scenarios
- [ ] All existing tests still pass
