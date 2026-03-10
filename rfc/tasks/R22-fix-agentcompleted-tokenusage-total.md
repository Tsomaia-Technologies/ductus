# R22 — Add total to AgentCompleted.tokenUsage

**Severity:** LOW
**Audit ref:** L3
**Depends on:** R07 (if addressed together)
**Blocks:** None

---

## Problem

RFC Section 11.1 shows `tokenUsage.total` in the `AgentCompleted` event. Implementation only has `{ input, output }` with no `total` field. A consumer wanting total tokens must compute `input + output` manually.

---

## 1. Exploration

- `src/events/observation-events.ts` — `AgentCompleted` definition
- `src/core/agent-invocation.ts` — `InvocationResult.tokenUsage`

---

## 2. Implementation

### 2.1 Add `total` to the observation event schema

```typescript
export const AgentCompleted = signal('Ductus/AgentCompleted', {
  agent: string(),
  skill: string(),
  durationMs: number(),
  tokenUsage: object({
    input: number(),
    output: number(),
    total: number(),
  }),
})
```

### 2.2 Update `InvocationResult.tokenUsage`

Add `total` to the return value:
```typescript
tokenUsage: {
  input: totalInput,
  output: totalOutput,
  total: totalInput + totalOutput,
}
```

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Update tests that reference `tokenUsage` to verify `total`
- Run existing tests

---

## 4. Self-Review

- [ ] `total` field added to event schema
- [ ] `total` computed as `input + output` in `invokeAgent`
- [ ] Tests verify `total`
