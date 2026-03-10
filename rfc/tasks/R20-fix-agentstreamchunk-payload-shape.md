# R20 — Resolve AgentStreamChunk Payload Shape

**Severity:** LOW
**Audit ref:** L1
**Depends on:** R07 (if addressed together)
**Blocks:** None

---

## Problem

RFC Section 11.1 specifies `AgentStreamChunk` payload as `{ agent, skill, chunk }` (nested object). Implementation has `{ agent, skill, chunkType, content }` (flattened). This is a design decision that needs to be resolved and documented.

---

## 1. Exploration

- `src/events/observation-events.ts` — `AgentStreamChunk` definition
- RFC Section 11.1 — payload table

---

## 2. Implementation

### Decision: Keep flattened, update RFC

The flattened form `{ chunkType, content }` is better for observability:
- Consumers can filter by `chunkType` without unwrapping
- `content` is directly accessible
- Simpler schema

**Action:** Update RFC Section 11.1 payload table for `AgentStreamChunk` to match the implementation:

| Event | Payload |
|---|---|
| `AgentStreamChunk` | `{ agent, skill, chunkType, content }` |

---

## 3. Checks

- RFC updated
- No code changes needed

---

## 4. Self-Review

- [ ] RFC payload table matches implementation
- [ ] Rationale documented
