# Task 06 — Tool Builder

**Phase:** 2 (Builders)
**Depends on:** Task 01 (ToolEntity interface)
**Blocks:** Task 10
**Parallelizable with:** Tasks 07, 08

---

## Objective

Implement the fluent builder for `Ductus.tool()` and the corresponding factory function. This follows the same immutable builder pattern used throughout Ductus (`ImmutableProcessorBuilder`, `ImmutableSkillBuilder`, etc.).

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/interfaces/entities/tool-entity.ts` — the `ToolEntity` and `ToolContext` interfaces (created in Task 01)
- `src/interfaces/builders/__internal__.ts` — the `BUILD` symbol, `Buildable` interface, `build()` helper
- `src/builders/immutable-skill-builder.ts` — reference for the immutable builder pattern (clone-on-write)
- `src/interfaces/builders/skill-builder.ts` — reference for how builder interfaces are structured
- `src/interfaces/schema.ts` — the `Schema` type
- `src/factories.ts` — where `Ductus.tool()` will be added (in Task 12, not this task)

Confirm you understand:
- The clone-on-write pattern: each builder method creates a new instance with updated params, returning the new instance
- The `[BUILD]()` method: produces the final entity, validates required fields, throws on missing required fields
- The `Buildable<T>` interface that all builders implement

---

## 2. Implementation

### 2.1 Create `src/interfaces/builders/tool-builder.ts`

Define the builder interface. Write the exact interface below:

```typescript
import { Buildable } from './__internal__.js'
import { ToolEntity, ToolContext } from '../entities/tool-entity.js'
import { Schema } from '../schema.js'

export interface ToolBuilder<TInput = unknown, TOutput = unknown> extends Buildable<ToolEntity<TInput, TOutput>> {
  name(name: string): ToolBuilder<TInput, TOutput>

  description(description: string): ToolBuilder<TInput, TOutput>

  input<U>(schema: Schema): ToolBuilder<U, TOutput>

  execute<V>(
    fn: (input: TInput, context: ToolContext) => Promise<V>,
  ): ToolBuilder<TInput, V>
}
```

### 2.2 Create `src/builders/immutable-tool-builder.ts`

Implement the builder following the clone-on-write pattern from other Ductus builders.

**Requirements:**
- Private `params` object holds `name`, `description`, `inputSchema`, `execute`
- Each method returns a new builder instance with the updated field
- `[BUILD]()` validates:
  - `name` is required (non-empty string)
  - `description` is required (non-empty string)
  - `inputSchema` is required
  - `execute` is required
  - Throws `Error` with descriptive message if any required field is missing
- `[BUILD]()` returns a `ToolEntity` object

**Follow the exact same constructor/clone pattern as `ImmutableSkillBuilder`.**

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Verify the builder compiles with a usage example (type-check only, no runtime):
  ```typescript
  import Ductus from './factories.js'
  // This won't work yet (factory not wired), but the builder itself should compile:
  import { ImmutableToolBuilder } from './builders/immutable-tool-builder.js'
  const builder = new ImmutableToolBuilder()
    .name('ReadFile')
    .description('Read a file')
    .input(Ductus.object({ path: Ductus.string() }))
    .execute(async (input, { use }) => {
      return 'file contents'
    })
  ```
- Verify `[BUILD]()` throws when required fields are missing.

---

## 4. Report

After completing the task, provide:
- List of files created
- Confirmation that `npx tsc --noEmit` passes
- Any type inference issues encountered (especially around generic propagation in `.input()` and `.execute()`)

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] Builder interface is in `src/interfaces/builders/tool-builder.ts`
- [ ] Builder implementation is in `src/builders/immutable-tool-builder.ts`
- [ ] Implements `Buildable<ToolEntity<TInput, TOutput>>`
- [ ] Uses clone-on-write pattern (each method returns new instance)
- [ ] `[BUILD]()` validates all four required fields
- [ ] `[BUILD]()` returns a plain `ToolEntity` object (not the builder)
- [ ] Generic type parameters propagate correctly through `.input()` and `.execute()`
- [ ] No circular imports
- [ ] Follows the same code style as other builders in the codebase

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. Generic propagation — does `.input<U>()` correctly narrow `TInput` in subsequent `.execute()` calls?
2. Validation messages — are the error messages from `[BUILD]()` clear and actionable?
3. Should the builder accept a `Schema` for input, or should it also accept raw Zod shapes (like `Ductus.object({...})`)?
