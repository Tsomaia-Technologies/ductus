# R11 — Wire Hallucination Tracking

**Severity:** HIGH
**Audit ref:** H13
**Depends on:** R01, R10
**Blocks:** None

---

## Problem

`hallucinations: number` exists on both `AgentLifecycleState` and `AgentLifecycleStateV2`, but nothing ever increments it. RFC Section 1.3 and Open Question #7 mention connecting assertion failures to the hallucination counter. The field is declared but dead.

---

## 1. Exploration

- `src/interfaces/agent-lifecycle.ts` — `hallucinations` field on both V1 and V2
- `src/core/agent-invocation.ts` — skill assertion failures in the retry loop
- `src/core/agent-dispatcher.ts` — V2 lifecycle state
- RFC Section 4.4 — relationship between retries, failures, and hallucinations

---

## 2. Implementation

### 2.1 Define what counts as a hallucination

Per the agent builder JSDoc (and RFC intent), hallucinations include:
- Invalid output format (schema validation failure)
- False claims about performed checks (assertion failure)
- Data that doesn't match what the framework can verify

**Decision needed:** Should ALL assertion failures increment hallucinations, or only specific ones? Propose: assertion failures that indicate the agent lied about its output (as opposed to genuine errors) count as hallucinations.

**Pragmatic approach:** Increment `hallucinations` on every skill assertion failure. The distinction between "hallucination" and "error" can be refined later via a configuration option on `.assert()`.

### 2.2 Return hallucination signal from `invokeAgent`

Add to `InvocationResult`:
```typescript
assertionFailures: number  // number of assertion failures before success (or total if exhausted)
```

### 2.3 Increment hallucination counter in dispatcher

In `invokeAndParseV2`, after `invokeAgent` returns:
```typescript
stateV2.hallucinations += result.assertionFailures
```

### 2.4 Wire to lifecycle enforcement

R10 already enforces `maxRecognizedHallucinations`. Once the counter is incremented, the enforcement will trigger automatically.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Test: agent with `maxRecognizedHallucinations(2)`, trigger 2 assertion failures across invocations, verify lifecycle resets
- Run existing tests

---

## 4. Self-Review

- [ ] `invokeAgent` tracks assertion failures and includes count in result
- [ ] Dispatcher increments `hallucinations` counter
- [ ] `enforceLifecycleLimitsV2` checks `maxRecognizedHallucinations`
- [ ] Counter persists across invocations within one lifecycle
