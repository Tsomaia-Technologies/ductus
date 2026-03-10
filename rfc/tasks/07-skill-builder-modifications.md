# Task 07 — Skill Builder Modifications

**Phase:** 2 (Builders)
**Depends on:** Task 02 (modified SkillEntity with assert/maxRetries/tools)
**Blocks:** Task 12
**Parallelizable with:** Tasks 06, 08

---

## Objective

Extend the existing `SkillBuilder` interface and `ImmutableSkillBuilder` implementation to support the new skill capabilities: `.assert()`, `.maxRetries()`, and skill-level `.tool()` attachment.

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/interfaces/builders/skill-builder.ts` — current skill builder interface
- `src/builders/immutable-skill-builder.ts` — current skill builder implementation
- `src/interfaces/entities/skill-entity.ts` — modified skill entity (from Task 02) with `assert`, `maxRetries`, `tools`
- `src/interfaces/entities/tool-entity.ts` — `ToolEntity` (from Task 01)
- `src/interfaces/builders/tool-builder.ts` — `ToolBuilder` (from Task 06)
- `src/interfaces/builders/__internal__.ts` — `Buildable`, `BUILD`, `isBuildable`, `build`
- `src/interfaces/event-generator.ts` — `Injector` type (used in `SkillAssertContext`)

Confirm you understand:
- The current `SkillBuilder<T>` interface (generic over output type)
- The clone-on-write pattern in `ImmutableSkillBuilder`
- The `SkillAssertContext` interface from the modified `skill-entity.ts`
- That `.assert()` accepts `(output: T, context: SkillAssertContext) => void | Promise<void>` — generic over the skill's output type
- That `.tool()` can accept either a `ToolBuilder` or a `ToolEntity` (the builder should handle both via `isBuildable()`)

---

## 2. Implementation

### 2.1 Modify `src/interfaces/builders/skill-builder.ts`

Add three new methods to the `SkillBuilder` interface. The updated interface:

```typescript
import { Schema } from '../schema.js'
import { Buildable } from './__internal__.js'
import { SkillEntity, SkillAssertContext } from '../entities/skill-entity.js'
import { Infer } from '../event.js'
import { ToolBuilder } from './tool-builder.js'
import { ToolEntity } from '../entities/tool-entity.js'

export interface SkillBuilder<T = unknown> extends Buildable<SkillEntity> {
  name(name: string): SkillBuilder<T>

  input(schema: Schema, template?: string): SkillBuilder<T>

  output<U extends Schema>(schema: U): SkillBuilder<Infer<U>>

  assert(
    fn: (output: T, context: SkillAssertContext) => void | Promise<void>,
  ): SkillBuilder<T>

  maxRetries(count: number): SkillBuilder<T>

  tool(tool: ToolBuilder | ToolEntity): SkillBuilder<T>
}
```

### 2.2 Modify `src/builders/immutable-skill-builder.ts`

Add the implementations for `assert()`, `maxRetries()`, and `tool()`.

**Requirements:**

1. **`assert(fn)`** — stores the assertion function in the builder's params. The `[BUILD]()` method includes it in the `SkillEntity` as `assert`.
2. **`maxRetries(count)`** — stores the retry count. `[BUILD]()` includes it as `maxRetries`. Validate that `count >= 0` in `[BUILD]()`.
3. **`tool(tool)`** — accumulates tools into an array. If the argument is a `ToolBuilder` (check with `isBuildable()`), call `build()` on it to get the `ToolEntity`. Append to the tools array. Each `.tool()` call adds one tool.
4. All three methods follow the clone-on-write pattern.
5. `[BUILD]()` includes the new fields in the returned `SkillEntity`.

**Important:** The `.tool()` method must accumulate (not replace). If `.tool(A).tool(B)` is called, both tools must be in the result. Handle this by cloning the existing tools array and appending.

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Verify existing code that uses `SkillBuilder` still compiles (the changes are additive — new optional methods).
- Verify type inference works: after `.output(schema)`, the `.assert()` function's first parameter should be typed as the inferred output type.
- Check that `[BUILD]()` correctly includes `assert`, `maxRetries`, and `tools` in the produced `SkillEntity`.
- Grep for all usages of `ImmutableSkillBuilder` and `SkillBuilder` to ensure nothing is broken.

---

## 4. Report

After completing the task, provide:
- List of files modified
- Confirmation that `npx tsc --noEmit` passes
- Confirmation that existing builder usages (found via grep) still compile
- Any type inference issues with the generic `T` parameter in `.assert()`

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] `.assert()` parameter is `(output: T, context: SkillAssertContext) => void | Promise<void>` — generic over output type
- [ ] `.maxRetries()` accepts `number`, validation happens in `[BUILD]()`
- [ ] `.tool()` accepts both `ToolBuilder` and `ToolEntity` (uses `isBuildable()` to distinguish)
- [ ] `.tool()` accumulates — calling it twice adds both tools
- [ ] Clone-on-write pattern is maintained for all three new methods
- [ ] `[BUILD]()` includes `assert`, `maxRetries`, `tools` in the output entity (as optional fields)
- [ ] Existing `SkillBuilder` methods (`name`, `input`, `output`) are unchanged
- [ ] Import of `isBuildable` and `build` from `__internal__.ts` is present in the implementation file
- [ ] No existing tests broken

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. Tool accumulation pattern — is cloning the array on each `.tool()` call correct, or should it use a different approach?
2. Generic type propagation — does `.assert()` correctly see the output type after `.output()` is called?
3. Should `.maxRetries(0)` be valid (meaning "no retries, but assertion still runs")?
4. Is the `ToolBuilder | ToolEntity` union the right approach for `.tool()`, or should it only accept one?
