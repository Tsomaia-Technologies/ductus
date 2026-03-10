# R05 — Remove Undocumented outputFormat from TransportRequest

**Severity:** HIGH
**Audit ref:** H3
**Depends on:** None
**Blocks:** None

---

## Problem

`TransportRequest` in `src/interfaces/agent-transport.ts` (line 16) has `outputFormat?: 'text' | 'json'` which is not in the RFC's definition (Section 8.1). This is an undocumented addition that leaks transport-implementation concerns into the framework interface.

---

## 1. Exploration

- `src/interfaces/agent-transport.ts` — the `outputFormat` field
- Grep for any usage of `outputFormat` across the codebase
- Determine if any code sets or reads this field

---

## 2. Implementation

### 2.1 Remove `outputFormat` from `TransportRequest`

If no code uses it, remove the field. If it is used somewhere, either:
- Document it in the RFC as an intentional addition
- Or move the concern to the transport implementation (transport can decide internally based on model capabilities)

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- No references to `outputFormat` remain
- Run existing tests

---

## 4. Self-Review

- [ ] `outputFormat` removed from `TransportRequest`
- [ ] No code references the removed field
- [ ] Tests pass
