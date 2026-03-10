# R27 — Add End-to-End V2 Reaction Test

**Severity:** HIGH
**Audit ref:** C1-C3 verification
**Depends on:** R00, R01, R02
**Blocks:** None

---

## Problem

There is no end-to-end test that verifies a reaction flowing through the V2 path: trigger event → reaction → invoke agent (V2) → tool loop → assertion → retry → observation events → yielded from pipeline → committed/broadcast. The integration tests (`agentic-integration.test.ts`) test `invokeAgent` in isolation but not the full pipeline path.

---

## 1. Exploration

- `src/__tests__/agentic-integration.test.ts` — existing tests (isolated `invokeAgent`)
- `src/utils/internals.ts` — `executePipeline` (after R00 wiring)
- `src/core/agent-dispatcher.ts` — V2 path
- `src/factories.ts` — kernel creation with V2 agents

---

## 2. Implementation

### 2.1 Create `src/__tests__/v2-reaction-e2e.test.ts`

Write a comprehensive end-to-end test that:

1. **Sets up a full kernel** with:
   - A store (in-memory)
   - A reducer
   - An agent with `defaultTransport`, `defaultModel`, `contextPolicy`, `observation`
   - A skill with `assert`, `maxRetries`
   - A tool
   - A reaction: `.when(TriggerEvent).invoke(Agent, Skill).emit(ResultEvent)`
   - A processor that collects observation events

2. **Boots the kernel** and emits a trigger event

3. **Verifies:**
   - Agent is invoked via V2 path
   - Tool is called and result fed back
   - Output is parsed
   - Skill assertion runs
   - On assertion failure: retry occurs with feedback
   - Observation events (`AgentInvoked`, `SkillInvoked`, `ToolRequested`, `ToolCompleted`, `SkillCompleted`, `AgentCompleted`) are emitted
   - Observation events reach the subscriber processor
   - Final `ResultEvent` is committed to the ledger

4. **Verifies conversation state:**
   - Context policy is applied between invocations
   - Conversation grows correctly through tool loop

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- `npx jest src/__tests__/v2-reaction-e2e.test.ts` — all tests pass
- Run all tests to verify no regressions

---

## 4. Self-Review

- [ ] Full end-to-end path tested (event → reaction → V2 invoke → pipeline → commit)
- [ ] Tool loop verified
- [ ] Assertion + retry verified
- [ ] Observation events verified
- [ ] Context policy verified
- [ ] No mocking of core components (only transport is mocked)

---

## 6. Manual Review Request

Highlight:
1. Does the test cover all RFC invocation sequence steps?
2. Is the mock transport realistic (proper chunk sequences)?
3. Are observation events verified in order?
