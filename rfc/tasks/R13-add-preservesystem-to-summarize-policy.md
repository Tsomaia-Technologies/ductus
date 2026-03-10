# R13 — Add preserveSystem to SummarizeContextPolicy

**Severity:** MEDIUM
**Audit ref:** M2
**Depends on:** None
**Blocks:** None

---

## Problem

RFC Section 5.4 shows `preserveSystem: true` as a config option for `SummarizeContextPolicy`. The implementation only has `targetTokens` and `preserveLastN`. The `preserveSystem` option is missing.

---

## 1. Exploration

- `src/core/context-policies/summarize-context-policy.ts` — `SummarizeOptions`
- RFC Section 5.4 — the example configuration

---

## 2. Implementation

### 2.1 Add `preserveSystem` option

```typescript
export interface SummarizeOptions {
  targetTokens?: number
  preserveLastN?: number
  preserveSystem?: boolean  // new — defaults to true
}
```

### 2.2 Handle in apply()

The system message is always preserved via `ConversationImpl.create(conversation.systemMessage)` — it is part of the conversation constructor, not the messages array. So `preserveSystem: true` is already the default behavior.

If `preserveSystem: false`, the summarization should use an empty system message:
```typescript
const systemMsg = this.preserveSystem ? conversation.systemMessage : ''
let result = ConversationImpl.create(systemMsg)
```

Default to `true`.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Add test for `preserveSystem: false`
- Run existing context policy tests

---

## 4. Self-Review

- [ ] `preserveSystem` option exists with `true` default
- [ ] `preserveSystem: false` clears the system message
- [ ] `preserveSystem: true` preserves it (existing behavior)
- [ ] Tests cover both cases
