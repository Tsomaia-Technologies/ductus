# R17 — Document ToolContext.use and SkillAssertContext.use Type Deviation

**Severity:** HIGH (interface deviation)
**Audit ref:** H5, H6
**Depends on:** None
**Blocks:** None

---

## Problem

RFC Section 3.2 defines `ToolContext.use` as `<T>(token: string) => T`. RFC Section 4.2 defines `SkillAssertContext.use` as `<T>(token: string) => T`. Both implementations use `use: Injector` — the full DI `Injector` interface which takes `Type<T> | Token<T>`, not a string.

The implementation is arguably better (type-safe DI tokens vs magic strings), but it deviates from the RFC.

---

## 1. Exploration

- `src/interfaces/entities/tool-entity.ts` — `ToolContext.use: Injector`
- `src/interfaces/entities/skill-entity.ts` — `SkillAssertContext.use: Injector`
- `src/interfaces/event-generator.ts` — `Injector` interface
- RFC Sections 3.2 and 4.2 — specified `use` types

---

## 2. Implementation

### Decision: Keep Injector, update RFC

The `Injector` type is strictly better than `<T>(token: string) => T`:
- Type-safe: `Token<T>` carries the type parameter, so `use(MyToken)` returns `T` without casting
- Supports class injection: `use(MyService)` returns `MyService` instance
- Already used throughout the framework

**Action:** Update RFC Sections 3.2 and 4.2 to reflect the actual `Injector` type. Document this as a deliberate improvement:

```typescript
// RFC update — Section 3.2
interface ToolContext<TState = unknown> {
  getState: () => TState
  use: Injector   // framework DI injector (not string-based)
  emit: (event: BaseEvent) => void
}
```

---

## 3. Checks

- RFC document updated
- No code changes needed

---

## 4. Self-Review

- [ ] RFC Section 3.2 `ToolContext.use` updated to `Injector`
- [ ] RFC Section 4.2 `SkillAssertContext.use` updated to `Injector`
- [ ] Rationale documented in the RFC
