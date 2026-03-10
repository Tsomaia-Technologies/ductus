# R18 — Fix ephemeral() Return Type (void → this)

**Severity:** LOW
**Audit ref:** L6
**Depends on:** None
**Blocks:** None

---

## Problem

`AgentBuilder.ephemeral()` in `src/interfaces/builders/agent-builder.ts` (line 92) returns `void`. The implementation in `ImmutableAgentBuilder` returns `this`. The interface should return `this` for fluent chaining consistency with all other builder methods.

---

## 1. Exploration

- `src/interfaces/builders/agent-builder.ts` — `ephemeral(): void`
- `src/builders/immutable-agent-builder.ts` — `ephemeral(): this`

---

## 2. Implementation

Change the interface:
```typescript
ephemeral(): this  // was: void
```

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Run existing tests

---

## 4. Self-Review

- [ ] Interface declares `ephemeral(): this`
- [ ] Implementation matches
- [ ] No regression
