# R15 — Fix SlidingWindowContextPolicy Ignoring limit Parameter

**Severity:** MEDIUM
**Audit ref:** M5
**Depends on:** None
**Blocks:** None

---

## Problem

`SlidingWindowContextPolicy` in `src/core/context-policies/sliding-window-context-policy.ts` (line 24) uses `this.windowTokens` instead of the `limit` parameter. This means `maxContextTokens` on the agent is ignored — only the constructor option matters. Other policies respect the `limit` parameter.

---

## 1. Exploration

- `src/core/context-policies/sliding-window-context-policy.ts` — `apply()` method
- `src/core/agent-dispatcher.ts` — `enforceContextPolicy()` passes `agentConfig.maxContextTokens` as `limit`
- Other context policies — how they use `limit`

---

## 2. Implementation

Use the `limit` parameter instead of (or in combination with) `windowTokens`:

```typescript
async apply(
  conversation: Conversation,
  limit: number,
  _transport: AgentTransport,
): Promise<Conversation> {
  const effectiveWindow = Math.min(this.windowTokens, limit)
  const messages = conversation.messages
  const retained = selectFromEnd(messages, effectiveWindow, 0)
  // ...
}
```

This respects both the policy's window configuration AND the agent's `maxContextTokens` limit.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Add test: policy with `windowTokens: 1000` but `limit: 500` → uses 500
- Add test: policy with `windowTokens: 500` but `limit: 1000` → uses 500
- Run existing tests

---

## 4. Self-Review

- [ ] `limit` parameter is respected
- [ ] `windowTokens` acts as an additional constraint (effective = min of both)
- [ ] Tests verify both directions
