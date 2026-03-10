# R14 — Fix AgentChunkData.data Typing (any → unknown)

**Severity:** MEDIUM
**Audit ref:** M3
**Depends on:** None
**Blocks:** None

---

## Problem

`AgentChunkData.data` in `src/interfaces/agent-chunk.ts` (line 42) is typed as `any`. RFC Section 12 specifies `data: unknown`. Using `any` defeats TypeScript's type safety — consumers can access arbitrary properties without type checking.

---

## 1. Exploration

- `src/interfaces/agent-chunk.ts` — `AgentChunkData`
- Grep for `chunk.data` or `.data` usage on chunks to find any code that relies on `any` typing
- `src/core/output-parser.ts` — `parseAgentOutput` accesses `dataChunks[...].data`

---

## 2. Implementation

Change:
```typescript
export interface AgentChunkData extends AgentChunkBase {
  type: 'data'
  data: unknown  // was: any
}
```

Fix any compilation errors caused by the stricter typing.

---

## 3. Checks

- `npx tsc --noEmit` — must pass (fix any errors)
- Run all tests

---

## 4. Self-Review

- [ ] `data` field typed as `unknown`
- [ ] All code accessing `.data` handles the `unknown` type correctly (with casts or type guards)
- [ ] No regression
