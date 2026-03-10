# R26 — Fix Schema = ZodSchema Leak

**Severity:** MEDIUM
**Audit ref:** M8
**Depends on:** None
**Blocks:** None

---

## Problem

`src/interfaces/schema.ts` has `export type Schema = ZodSchema` — a raw Zod type leak. RFC Section 16 flags this as an open question. The concern is that framework users import `Schema` and see it's just `ZodSchema`, which ties the framework's public API to Zod.

---

## 1. Exploration

- `src/interfaces/schema.ts` — the type alias
- Grep for `Schema` usage across the codebase
- RFC Section 16 — Open Question #2

---

## 2. Implementation

### Decision needed

**Option A: Keep `Schema = ZodSchema`, add JSDoc**
Accept the Zod coupling for now. Add a JSDoc note:
```typescript
/**
 * Schema type used for validation throughout Ductus.
 * Currently backed by Zod. This may change in a future version.
 * Import `Schema` instead of `ZodSchema` to future-proof your code.
 */
export type Schema = ZodSchema
```

**Option B: Create an abstract `Schema` interface**
Define a Ductus-owned schema interface with `parse(data: unknown): T` and `toJsonSchema(): Record<string, unknown>` methods. Add a Zod adapter.

**Recommendation:** Option A for now — Option B is a larger refactor. Document the intent to abstract later.

---

## 3. Checks

- JSDoc added
- No functional changes

---

## 4. Self-Review

- [ ] `Schema` type has clear documentation about Zod coupling
- [ ] Users are guided to import `Schema`, not `ZodSchema`
- [ ] RFC Open Question #2 is addressed (marked as "deferred with documentation")
