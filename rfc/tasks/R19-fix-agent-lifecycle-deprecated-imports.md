# R19 — Clean Up agent-lifecycle.ts Deprecated Imports

**Severity:** LOW
**Audit ref:** L5
**Depends on:** None
**Blocks:** None

---

## Problem

`src/interfaces/agent-lifecycle.ts` (line 1) imports both `AgentAdapter` and `AdapterEntity` — deprecated types. The non-deprecated `AgentLifecycleState` interface references `AgentAdapter` for its `adapter` field. This creates a dependency chain from non-deprecated code to deprecated code.

---

## 1. Exploration

- `src/interfaces/agent-lifecycle.ts` — imports and usage
- Who uses `AgentLifecycleState`?
- Can `AgentLifecycleState` itself be deprecated (since V2 uses `AgentLifecycleStateV2`)?

---

## 2. Implementation

### 2.1 Add @deprecated to AgentLifecycleState

Since V2 has `AgentLifecycleStateV2`, the old `AgentLifecycleState` should also be deprecated:

```typescript
/** @deprecated Use {@link AgentLifecycleStateV2} instead. */
export interface AgentLifecycleState { ... }
```

This makes the entire V1 lifecycle chain consistently deprecated.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- No functional changes

---

## 4. Self-Review

- [ ] `AgentLifecycleState` has `@deprecated` JSDoc
- [ ] All V1 lifecycle types are consistently deprecated
- [ ] Import chain is documented as deprecated
