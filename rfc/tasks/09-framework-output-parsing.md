# Task 09 — Framework Output Parsing

**Phase:** 3 (Core Runtime)
**Depends on:** Task 00 (AgentChunk types), Task 02 (SkillEntity with output schema)
**Blocks:** Task 10, Task 11
**Sequential:** Must be completed before Task 10

---

## Objective

Move output parsing from the adapter into the framework. Currently, `AgentAdapter.parse(chunks)` is responsible for extracting structured data from agent output. This task creates a framework-level parser that:
1. Collects text chunks from an agent response
2. Extracts JSON from the collected text
3. Validates the JSON against the skill's output schema (Zod)
4. Returns the typed, validated result

This replaces `adapter.parse()` and makes output parsing a framework concern.

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/interfaces/agent-chunk.ts` — all chunk types, especially `AgentChunkText`, `AgentChunkData`, `AgentChunkComplete`
- `src/interfaces/entities/skill-entity.ts` — `SkillEntity.output` is a `Schema` (ZodSchema)
- `src/interfaces/schema.ts` — `Schema = ZodSchema`
- `src/utils/internals.ts` — `executePipeline` and how `dispatcher.invokeAndParse()` is called (lines 97-163)
- `src/core/agent-dispatcher.ts` — `invokeAndParse()` method (lines 147-172), see how chunks are collected and `adapter.parse()` is called

Confirm you understand:
- The current flow: chunks are collected into an array, then `adapter.parse(chunks)` extracts the result
- `AgentChunkData` has a `data: any` field — some transports (JSON mode) may send structured data directly
- `AgentChunkText` has `content: string` — needs JSON extraction from text
- The skill's `output` field is a Zod schema — `.parse(data)` validates and returns typed data

---

## 2. Implementation

### 2.1 Create `src/core/output-parser.ts`

Implement a `parseAgentOutput` function (not a class — this is a pure function).

**Signature:**

```typescript
function parseAgentOutput(chunks: AgentChunk[], outputSchema: Schema): unknown
```

**Logic:**

1. **Check for structured data first.** If any chunk has `type === 'data'`, use the LAST `data` chunk's `.data` field as the raw output. Skip JSON extraction.
2. **Otherwise, collect text.** Concatenate all `type === 'text'` chunks' `.content` into a single string.
3. **Extract JSON from text.** Try these strategies in order:
   a. `JSON.parse(fullText)` — the entire response is valid JSON
   b. Find the last occurrence of a JSON block (regex: match content between the outermost `{` and `}` or `[` and `]`). Try `JSON.parse()` on that.
   c. Find a markdown code block with json/JSON fencing (`` ```json ... ``` ``). Extract and parse.
   d. If none work, throw an error: `"Failed to extract JSON from agent response"`
4. **Validate against schema.** Call `outputSchema.parse(rawJson)`. If Zod throws, let it propagate (the caller handles it).
5. **Return the validated result.**

**Error handling:**
- If no text and no data chunks exist, throw: `"Agent produced no output"`
- If JSON extraction fails, throw with the raw text truncated to 200 chars for debugging
- Zod validation errors propagate as-is

### 2.2 Export from `src/core/output-parser.ts`

Export `parseAgentOutput` as a named export.

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Write a test file at `src/__tests__/output-parser.test.ts` that verifies:
  1. **Pure JSON response:** chunks = `[text('{"code": "x", "files": ["a.ts"]}'), complete()]` — parses correctly.
  2. **JSON in markdown block:** chunks = `[text('Here is the result:\n```json\n{"code": "x"}\n```'), complete()]` — extracts and parses.
  3. **Mixed text with JSON:** chunks = `[text('I will implement this. '), text('{"code": "x", "files": []}'), complete()]` — extracts JSON portion.
  4. **Data chunk shortcut:** chunks = `[data({ code: 'x', files: [] }), complete()]` — uses data directly, skips text.
  5. **No output:** chunks = `[complete()]` — throws "no output" error.
  6. **Invalid JSON:** chunks = `[text('This is not JSON'), complete()]` — throws extraction error.
  7. **Schema validation failure:** chunks = `[text('{"wrong": "shape"}'), complete()]` with a schema expecting `{ code: string }` — throws Zod error.
  8. **Multiple text chunks concatenated:** chunks = `[text('{"co'), text('de": "x"}'), complete()]` — concatenation produces valid JSON.
- Run tests: `npx jest src/__tests__/output-parser.test.ts`

---

## 4. Report

After completing the task, provide:
- Files created
- Test results
- Confirmation that `npx tsc --noEmit` passes
- The JSON extraction strategies implemented and their priority order

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] Function is pure — no side effects, no state, no imports of runtime framework components
- [ ] Data chunks take priority over text chunks
- [ ] Multiple text chunks are concatenated before extraction
- [ ] JSON extraction tries full-parse first, then block extraction, then markdown fencing
- [ ] Schema validation uses `.parse()` (throws on failure), not `.safeParse()`
- [ ] Error messages include relevant context (truncated text for debugging)
- [ ] All 8 test cases pass
- [ ] No external dependencies added (uses only `zod` which is already a dependency)

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. JSON extraction strategy — is the priority order (full parse → brace matching → markdown fence) correct?
2. Brace matching — is a simple "find last `{`...`}`" sufficient, or do we need a proper brace-counting parser for nested JSON?
3. Should extraction be configurable per skill (e.g., `skill.outputFormat: 'json' | 'markdown-json'`), or is the current auto-detection sufficient?
4. Edge case: agent returns valid JSON that doesn't match the schema. Currently this throws a Zod error. Should the framework catch and wrap this with a more descriptive message?
