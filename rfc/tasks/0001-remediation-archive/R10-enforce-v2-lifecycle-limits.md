# R10 — Enforce V2 Lifecycle Limits (maxFailures, scope)

**Severity:** HIGH
**Audit ref:** H12
**Depends on:** R08
**Blocks:** None

---

## Problem

`invokeAndParseV2` tracks `failures` but never checks `maxFailures`, `maxRecognizedHallucinations`, or scope limits. There is no `enforceLifecycleLimits` call for the V2 path. Per RFC Section 4.4: "if agent.failures >= agent.maxFailures → replace agent (handoff)."

The old V1 `enforceLifecycleLimits` works only with `AgentLifecycleState` (V1). A V2 equivalent is needed.

---

## 1. Exploration

- `src/core/agent-dispatcher.ts` — `enforceLifecycleLimits()` (V1 version), `invokeAndParseV2()`
- `src/interfaces/entities/agent-entity.ts` — `maxFailures`, `maxRecognizedHallucinations`, `scope`
- `src/interfaces/agent-lifecycle.ts` — `AgentLifecycleStateV2`

---

## 2. Implementation

### 2.1 Create `enforceLifecycleLimitsV2`

Add a V2 lifecycle limit enforcement method that:
1. Checks `maxFailures` against `state.failures`
2. Checks `maxRecognizedHallucinations` against `state.hallucinations`
3. Checks scope limits (turn/task count vs `state.turns`)
4. If any limit is exceeded, handles replacement:
   - Close old transport
   - Create new lifecycle state (fresh conversation, reset counters)
   - Optionally emit `AgentReplaced` event

### 2.2 Call `enforceLifecycleLimitsV2` before each invocation

In `invokeAndParseV2`, call the enforcement method before the invocation (same pattern as V1).

### 2.3 Handle replacement in V2

V2 replacement is simpler than V1 (no adapter to terminate/recreate). Reset:
- Create new `ConversationImpl.create(systemMessage)` with handoff context if configured
- Reset `failures`, `hallucinations`, `turns` counters
- Keep the transport (transports are stateless per RFC)

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Test: agent with `maxFailures(2)`, trigger 2 failures, verify lifecycle resets
- Test: agent with `scope('turn', 3)`, invoke 3 times, verify lifecycle resets
- Run existing tests

---

## 4. Self-Review

- [ ] `maxFailures` limit enforced
- [ ] `maxRecognizedHallucinations` limit enforced (even though nothing increments it yet — see R11)
- [ ] Scope limits enforced
- [ ] Replacement resets conversation and counters
- [ ] Transport is NOT closed on replacement (stateless per RFC)
- [ ] Handoff context is applied if configured

---

## 6. Manual Review Request

Highlight:
1. Should the transport be closed and re-created on replacement, or kept as-is?
2. Is the handoff context composition correct for V2 (no adapter to get summary from)?
3. Should `AgentReplaced` observation event be emitted?
