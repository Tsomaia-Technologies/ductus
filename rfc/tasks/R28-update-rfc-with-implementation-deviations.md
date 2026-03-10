# R28 — Update RFC with Implementation Deviations

**Severity:** MEDIUM
**Audit ref:** All "update RFC" items from H5, H6, L1-L6, M3, M8
**Depends on:** R07, R17, R20, R21, R22, R26 (should be done after code changes are finalized)
**Blocks:** None

---

## Problem

Several implementation decisions deliberately deviate from the original RFC specification. These are improvements, not bugs, but the RFC must be updated to reflect reality. An outdated RFC is misleading for future developers.

---

## 1. Exploration

- `rfc/0001-agentic-layer-redesign.md` — the full RFC

---

## 2. Implementation

### 2.1 Section 3.2 — ToolContext.use

Update `use: <T>(token: string) => T` to `use: Injector`. Add note: "Type-safe DI injection via framework Injector."

### 2.2 Section 4.2 — SkillAssertContext.use

Same as 2.1.

### 2.3 Section 8.1 — TransportRequest

Remove `outputFormat` from the interface definition (if R05 removes it from code).

### 2.4 Section 9.1 — Conversation implementation

Update the `messages` getter code example if R06 changes the implementation.

### 2.5 Section 11.1 — Observation event payload tables

- `AgentStreamChunk`: `{ agent, skill, chunkType, content }` (flattened)
- Duration fields: `durationMs` (explicit units)
- `AgentCompleted.tokenUsage`: `{ input, output, total }`
- `AgentReplaced`: add `newAgent`
- `ToolCompleted`: add `resultSummary`
- `SkillInvoked`: add `inputHash`

### 2.6 Section 5.4 — SummarizeContextPolicy

Add `preserveSystem` option documentation.

### 2.7 Section 12 — AgentChunkData

Note `data: unknown` (not `any`).

### 2.8 Section 16 — Open Questions

Update status of resolved questions:
- Schema abstraction: "Deferred — `Schema = ZodSchema` with documentation"
- Hallucination tracking: "Resolved — assertion failures increment hallucination counter"

### 2.9 Add "Implementation Notes" section

Add a new section at the end documenting all deliberate deviations with rationale.

---

## 3. Checks

- RFC is internally consistent
- All TypeScript snippets in the RFC match the actual code
- No stale references

---

## 4. Self-Review

- [ ] All known deviations documented
- [ ] Code examples updated
- [ ] Open questions updated
- [ ] No stale interface definitions in the RFC
