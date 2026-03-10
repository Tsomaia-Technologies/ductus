# R06 — Optimize Conversation messages Getter

**Severity:** HIGH
**Audit ref:** H4, M4
**Depends on:** None
**Blocks:** None

---

## Problem

RFC Section 9.1 specifies `new Array(this._length)` with index-based assignment and reverse traversal (single O(n) pass). The implementation uses `push` into a dynamic array then `reverse()` — two passes with dynamic array growth. For large conversations this is measurably slower.

---

## 1. Exploration

- `src/core/conversation.ts` — `get messages()` implementation
- RFC Section 9.1 — the specified implementation pattern

---

## 2. Implementation

Replace the current `push` + `reverse` pattern with pre-allocated indexed assignment:

```typescript
get messages(): readonly AgenticMessage[] {
  if (this.head === null) return EMPTY_MESSAGES

  const result: AgenticMessage[] = new Array(this.length)
  let node: ConversationNode | null = this.head
  for (let i = this.length - 1; i >= 0; i--) {
    result[i] = node!.message
    node = node!.prev
  }
  return Object.freeze(result)
}
```

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Run `src/__tests__/conversation.test.ts` — all tests pass
- Run `src/__tests__/agentic-integration.test.ts` — all tests pass

---

## 4. Self-Review

- [ ] Messages getter uses pre-allocated array with indexed assignment
- [ ] Single O(n) traversal, no `reverse()`
- [ ] Frozen array returned
- [ ] Empty conversation returns `EMPTY_MESSAGES`
- [ ] All tests pass
