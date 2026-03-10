# R07 — Fix Observation Event Payloads to Match RFC

**Severity:** HIGH
**Audit ref:** H7, H8, H9, L1, L2, L3
**Depends on:** None (can be done before or after R01)
**Blocks:** None

---

## Problem

Several observation event payloads deviate from the RFC Section 11.1 specification:

1. **`AgentReplaced`** — missing `newAgent` field. RFC: `{ agent, reason, newAgent }`. Impl: `{ agent, reason }`.
2. **`ToolCompleted`** — missing `resultSummary` field. RFC: `{ agent, tool, duration, resultSummary }`. Impl: `{ agent, tool, durationMs }`.
3. **`SkillInvoked`** — missing `inputHash` field. RFC: `{ agent, skill, inputHash }`. Impl: `{ agent, skill }`.
4. **`AgentStreamChunk`** — payload flattened. RFC: `{ agent, skill, chunk }`. Impl: `{ agent, skill, chunkType, content }`.
5. **`AgentCompleted`** — uses `durationMs` instead of RFC's `duration`. RFC example uses `tokenUsage.total` but impl has `tokenUsage: { input, output }` with no `total`.
6. **`SkillCompleted`** — uses `durationMs` instead of RFC's `duration`.

---

## 1. Exploration

- `src/events/observation-events.ts` — all 11 event definitions
- RFC Section 11.1 — payload tables for each event
- `src/utils/schema-utils.ts` — available schema helpers

---

## 2. Implementation

### 2.1 Add `newAgent` to `AgentReplaced`

```typescript
export const AgentReplaced = signal('Ductus/AgentReplaced', {
  agent: string(),
  reason: string(),
  newAgent: string(),
})
```

### 2.2 Add `resultSummary` to `ToolCompleted`

```typescript
export const ToolCompleted = signal('Ductus/ToolCompleted', {
  agent: string(),
  tool: string(),
  durationMs: number(),
  resultSummary: string(),
})
```

### 2.3 Add `inputHash` to `SkillInvoked`

```typescript
export const SkillInvoked = signal('Ductus/SkillInvoked', {
  agent: string(),
  skill: string(),
  inputHash: string(),
})
```

### 2.4 Fix `AgentStreamChunk` payload structure

Decide: keep flattened `{ chunkType, content }` or match RFC `{ chunk }`. The flattened form is arguably better for observability (no nested wrapper). Document the decision and update the RFC if keeping the flattened form.

### 2.5 Add `total` to `AgentCompleted.tokenUsage`

Update `tokenUsage` to include a `total` field alongside `input` and `output`:

```typescript
tokenUsage: object({ input: number(), output: number(), total: number() }),
```

### 2.6 Naming decision: `durationMs` vs `duration`

`durationMs` is more explicit. Keep `durationMs` and update the RFC payload tables to match. Document this as a deliberate improvement over the RFC.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- No references to old payload shapes break
- If R01 is complete, update emission code to populate the new fields
- Run all tests

---

## 4. Self-Review

- [ ] `AgentReplaced` has `newAgent: string()`
- [ ] `ToolCompleted` has `resultSummary: string()`
- [ ] `SkillInvoked` has `inputHash: string()`
- [ ] `AgentCompleted.tokenUsage` has `total` field
- [ ] Decision made and documented for `AgentStreamChunk` shape
- [ ] Decision made and documented for `durationMs` vs `duration`
- [ ] RFC updated to reflect any deliberate deviations

---

## 6. Manual Review Request

Highlight:
1. Is `AgentStreamChunk` better as `{ chunk }` (RFC) or `{ chunkType, content }` (current)?
2. Should `durationMs` be kept (more explicit) or changed to `duration` (matches RFC)?
3. What should `resultSummary` contain? `JSON.stringify(result).slice(0, 200)`? Or `typeof result`?
