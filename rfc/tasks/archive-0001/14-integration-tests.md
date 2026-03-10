# Task 14 — Integration Tests

**Phase:** 5 (Validation)
**Depends on:** All previous tasks (00-13)
**Blocks:** Nothing (final task)

---

## Objective

Write an end-to-end integration test that exercises the complete new agentic layer: tool-calling agent, skill assertion with retry, observation events, context policy, and the full reaction pipeline. This test validates that all components from Tasks 00-13 work together correctly.

---

## 1. Exploration

Before writing any code, read and understand:

- `sample2/tests/setup.ts` — how existing integration tests set up the kernel, multiplexer, and processors
- `sample2/tests/backpressure/throttle/index.ts` — reference for test structure and assertion patterns
- `sample2/tests/state/index.ts` — reference for state-based assertions
- `src/factories.ts` — the full `Ductus.*` API surface (including new `tool`, `events`)
- `rfc/0001-agentic-layer-redesign.md` Section 10 — the invocation sequence that this test validates

Confirm you understand:
- How to set up a kernel with processors, reactions, and agents
- How to create a mock `AgentTransport` (one that returns predetermined chunks)
- How to define tools, skills with assertions, and agents with observations
- The full invocation flow: event → reaction → invoke → tool loop → parse → assert → retry → emit

---

## 2. Implementation

### 2.1 Create a mock transport

Create `sample2/tests/agentic/mock-transport.ts`:

A configurable mock `AgentTransport` that:
- Accepts a sequence of responses (each response is an array of `AgentChunk`)
- On each `send()` call, yields the next response in the sequence
- Tracks all `TransportRequest` objects received (for assertions)
- Supports tool-call → tool-result → resume patterns

### 2.2 Create the integration test

Create `sample2/tests/agentic/index.ts`:

**Test scenario: Code Implementation Agent**

Set up:
1. **A `ReadFile` tool** that reads from an in-memory file system and emits a `FileRead` event
2. **A `RunTests` tool** that always returns `{ passed: 3, failed: 0 }` and emits a `TestsExecuted` event
3. **An `ImplementSkill`** with:
   - Input schema: `{ task: string }`
   - Output schema: `{ code: string, files: string[], testsRun: boolean }`
   - `.assert()` that checks `output.testsRun === true` and `output.files.length > 0`
   - `.maxRetries(2)`
   - Skill-level tools: `[RunTests]`
4. **An `Engineer` agent** with:
   - Agent-level tools: `[ReadFile]`
   - `.skill(ImplementSkill)`
   - `.defaultModel(Ductus.model('mock-model'))`
   - `.defaultTransport(mockTransport)`
   - `.contextPolicy('truncate')`
   - `.observe(Ductus.events.AgentCompleted)` (durable)
   - `.observe(Ductus.events.ToolCompleted)`
   - `.observeSkill(ImplementSkill)` (all skill events)
5. **A reaction:**
   ```
   Ductus.reaction('implement')
     .when(TaskAssigned)
     .invoke(Engineer, ImplementSkill)
     .map((output, ctx) => ({ ...output, actor: ctx.agent?.name }))
     .emit(TaskCompleted)
   ```
6. **A reducer** that tracks completed tasks and observation event counts
7. **An observation processor** that counts received observation events

**Test sequence:**

**Test A: Happy path with tool calls**
- Mock transport responds with: tool-call(ReadFile) → then after tool result: tool-call(RunTests) → then after tool result: text(`{"code":"...", "files":["a.ts"], "testsRun": true}`) → complete
- Emit `TaskAssigned({ task: 'implement feature X' })`
- Assert:
  - `TaskCompleted` event is in the ledger with `actor: 'engineer'`
  - `FileRead` event was emitted (from ReadFile tool)
  - `TestsExecuted` event was emitted (from RunTests tool)
  - Observation events received: `SkillInvoked`, `ToolCompleted` (x2), `SkillCompleted`, `AgentCompleted`
  - Reducer state has the completed task
  - Mock transport received correct messages (user message with task, tool-call/result pairs)

**Test B: Skill assertion failure + retry**
- Mock transport first responds with: text(`{"code":"x", "files":[], "testsRun": false}`) → complete (this will fail the assertion: `files.length > 0`)
- Mock transport second response (retry): text(`{"code":"x", "files":["a.ts"], "testsRun": true}`) → complete
- Emit `TaskAssigned`
- Assert:
  - `SkillRetry` observation event was emitted (attempt 1)
  - `TaskCompleted` event is in the ledger (from the successful retry)
  - Mock transport received 2 `send()` calls (original + retry)
  - The retry request includes a feedback message about the assertion failure

**Test C: Retry exhaustion**
- Mock transport always responds with: text(`{"code":"x", "files":[], "testsRun": false}`) → complete
- `ImplementSkill` has `.maxRetries(2)`
- Emit `TaskAssigned`
- Assert:
  - `SkillRetry` emitted twice (attempt 1, attempt 2)
  - `SkillFailed` emitted once (retries exhausted)
  - No `TaskCompleted` event in the ledger
  - The reaction's `.error()` handler was invoked (if one exists) OR the processor error was logged

**Test D: Conversation immutability**
- After Test A, verify the mock transport's first received `TransportRequest` has conversation length 1 (just the user message)
- The second request (after tool call) has conversation length 3 (user + assistant with tool-call + tool result)
- The original conversation was not mutated

---

## 3. Checks

- Run the integration test: `npx tsx sample2/tests/agentic`
- All four test scenarios must pass
- Run `npx tsc --noEmit` — must pass
- Run all existing tests to confirm nothing is broken:
  - `npx tsx sample2/tests/state`
  - `npx tsx sample2/tests/backpressure/block`
  - `npx tsx sample2/tests/backpressure/fail`
  - `npx tsx sample2/tests/backpressure/throttle`
  - `npx jest`

---

## 4. Report

After completing the task, provide:
- Files created
- Test results for all four scenarios (A, B, C, D)
- Results of existing test suite (all passing)
- The complete invocation trace for Test A (step-by-step: which events were emitted, in what order)
- Any issues discovered during integration testing

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] Mock transport correctly simulates tool-call → tool-result → resume pattern
- [ ] Tool events (`FileRead`, `TestsExecuted`) appear in the ledger
- [ ] Observation events are received by the observation processor
- [ ] Observation events have correct payloads (agent name, skill name, duration, etc.)
- [ ] Retry feedback message appears in the conversation
- [ ] Conversation immutability is verified (original not mutated after append)
- [ ] Context policy is applied (truncate — though may not trigger in a short test)
- [ ] The reaction's `.map()` step correctly adds `actor` from context
- [ ] Reducer state reflects the completed tasks
- [ ] All existing tests still pass
- [ ] Test output is clean and readable (clear pass/fail indicators, no noisy logs)

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. **Test coverage:** do the four scenarios cover the critical paths? What's missing?
2. **Mock transport fidelity:** does the mock correctly simulate real transport behavior (especially around tool-call sequences)?
3. **Observation event assertions:** are we checking the right events with the right payloads?
4. **Error handling in Test C:** when retries are exhausted, what exactly happens to the reaction pipeline? Is the behavior tested correctly?
5. **Test isolation:** are the four tests independent, or do they share state? Should each create its own kernel?
6. **Is this test sufficient to merge the RFC implementation, or are additional test scenarios needed?**
