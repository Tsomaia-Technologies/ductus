# R03 — Fix Tool Schema Generation (Empty parameters)

**Severity:** HIGH
**Audit ref:** H1
**Depends on:** None
**Blocks:** None

---

## Problem

`toToolSchema` in `src/core/agent-invocation.ts` (line 33-38) always returns `parameters: {}` regardless of the tool's `inputSchema`. LLMs need the JSON Schema representation of parameters to know what arguments a tool accepts. Without this, tools are effectively unusable with any real transport.

---

## 1. Exploration

Read and understand:

- `src/core/agent-invocation.ts` — `toToolSchema()` function
- `src/interfaces/agent-transport.ts` — `ToolSchema.parameters: Record<string, unknown>`
- `src/interfaces/schema.ts` — `Schema = ZodSchema`
- Zod's `zodToJsonSchema` or equivalent method for converting a Zod schema to JSON Schema

Determine how to convert a Zod schema to a JSON Schema object. Options:
1. Use `zod-to-json-schema` package (external dependency)
2. Use Zod's built-in `.toJsonSchema()` if available in v3
3. Minimal manual conversion

---

## 2. Implementation

### 2.1 Convert tool inputSchema to JSON Schema

Update `toToolSchema` to produce real JSON Schema parameters from the tool's Zod input schema:

```typescript
function toToolSchema(tool: ToolEntity): ToolSchema {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.inputSchema),
  }
}
```

If `zod-to-json-schema` is not available, consider:
- Adding it as a dependency
- Using Zod v3's native `toJsonSchema()` if present
- A minimal wrapper that handles `ZodObject` at minimum

### 2.2 Handle edge cases

- Empty schemas (`z.object({})`) → `{ type: 'object', properties: {} }`
- Nested objects
- Arrays, enums, unions

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Write tests verifying:
  - `toToolSchema(tool)` produces correct JSON Schema for `z.object({ path: z.string() })`
  - `toToolSchema(tool)` produces correct JSON Schema for nested objects
  - `toToolSchema(tool)` handles `z.object({})` gracefully
- Run all existing tests

---

## 4. Report

- Approach chosen (external lib vs built-in vs manual)
- Files modified
- Test results

---

## 5. Self-Review

- [ ] `toToolSchema` produces real JSON Schema parameters
- [ ] Basic types (string, number, boolean) convert correctly
- [ ] Object types with properties convert correctly
- [ ] No regression in existing tool loop tests

---

## 6. Manual Review Request

Highlight:
1. Is the chosen conversion approach correct and maintainable?
2. Does the JSON Schema output match what LLM APIs (OpenAI, Anthropic) expect?
3. Should we add `zod-to-json-schema` as a dependency or keep it minimal?
