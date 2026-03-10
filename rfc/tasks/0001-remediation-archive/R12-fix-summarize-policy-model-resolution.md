# R12 — Fix SummarizeContextPolicy Model Resolution

**Severity:** MEDIUM
**Audit ref:** M1
**Depends on:** None
**Blocks:** None

---

## Problem

`SummarizeContextPolicy` in `src/core/context-policies/summarize-context-policy.ts` (line 44) uses `model: 'default'` — a magic string. The transport request needs a real model identifier. The policy receives the transport but has no way to know the correct model.

---

## 1. Exploration

- `src/core/context-policies/summarize-context-policy.ts` — the `TransportRequest` construction
- `src/interfaces/context-policy.ts` — `ContextPolicy.apply()` signature
- `src/core/agent-dispatcher.ts` — `enforceContextPolicy()` call site

---

## 2. Implementation

### Option A: Pass model to ContextPolicy.apply()

Extend the `ContextPolicy` interface to receive the model:

```typescript
interface ContextPolicy {
  apply(
    conversation: Conversation,
    limit: number,
    transport: AgentTransport,
    model?: string,
  ): Promise<Conversation>
}
```

Update `enforceContextPolicy` to pass the agent's resolved model.

### Option B: Accept model in SummarizeContextPolicy constructor

```typescript
constructor(options: SummarizeOptions & { model?: string } = {}) {
  this.model = options.model ?? 'default'
}
```

### Recommendation

Option A is better — it keeps model resolution centralized in the dispatcher rather than requiring users to know the model when constructing the policy.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Update context policy tests if interface changes
- Run all tests

---

## 4. Self-Review

- [ ] `SummarizeContextPolicy` receives a real model identifier
- [ ] All other context policy implementations accept the new parameter (even if unused)
- [ ] `enforceContextPolicy` passes the correct model
- [ ] `model: 'default'` magic string is eliminated
