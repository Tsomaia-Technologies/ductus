# Task 01 — Tool Entity Interfaces

**Phase:** 0 (Interface Lock)
**Depends on:** Nothing
**Blocks:** Tasks 06, 08, 10

---

## Objective

Define the interfaces for framework-level tools. Tools are auditable side effects that agents invoke during execution. The framework owns tool execution — when an LLM requests a tool call, the framework executes it, can emit events, and feeds the result back to the transport.

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/interfaces/schema.ts` — the `Schema` type used for tool input validation
- `src/interfaces/event.ts` — `BaseEvent` (tools can emit events)
- `src/interfaces/event-generator.ts` — `Injector`, `Injectable`, `Token` (tools use DI via `use`)
- `src/interfaces/store-adapter.ts` — `StoreAdapter` (tools access state via `getState`)
- `src/interfaces/agent-tool-call.ts` — `AgentToolCall` (what the LLM sends when requesting a tool)

Confirm you understand:
- The `Injector` type signature (callable with `Type<T>` or `Token<T>`)
- How `BaseEvent` is constructed (type + payload + volatility)
- That `Schema` is currently `ZodSchema` (tool input is validated via `.parse()`)

---

## 2. Implementation

### 2.1 Create `src/interfaces/entities/tool-entity.ts`

Write this file with the exact interfaces below. Do not deviate.

```typescript
import { Schema } from '../schema.js'
import { BaseEvent } from '../event.js'
import { Injector } from '../event-generator.js'

export interface ToolContext<TState = unknown> {
  getState: () => TState
  use: Injector
  emit: (event: BaseEvent) => void
}

export interface ToolEntity<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema: Schema
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>
}
```

### Design Rationale

- `ToolContext.emit` accepts `BaseEvent` (not `CommittedEvent`). The tool emits drafts; the sequencer commits them. This is the same pattern as processor `yield`.
- `ToolContext.use` is the framework's DI injector. Tools access external services (file system, test runner, HTTP client) through DI — not by importing them directly.
- `ToolContext.getState` provides read-only access to the current reducer state. Tools can make decisions based on application state.
- `ToolEntity` is generic over `<TInput, TOutput>` for type safety in the builder, but the entity itself stores `Schema` (which handles runtime validation).

---

## 3. Checks

- Run `npx tsc --noEmit` from the project root. The new file must compile without errors.
- Verify all imports resolve correctly (`../schema.js`, `../event.js`, `../event-generator.js`).
- Verify no existing files are broken. This is a new file with no modifications to existing code.

---

## 4. Report

After completing the task, provide:
- The file created
- Confirmation that `npx tsc --noEmit` passes
- Any observations about the interface (e.g., should `execute` allow synchronous returns?)

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] `ToolContext.emit` accepts `BaseEvent`, not `CommittedEvent`
- [ ] `ToolContext.use` is typed as `Injector` (the full interface from `event-generator.ts`)
- [ ] `ToolEntity.execute` returns `Promise<TOutput>` (always async)
- [ ] `ToolEntity.inputSchema` is `Schema` (not a generic — runtime validation, not compile-time)
- [ ] File uses named exports only
- [ ] No circular imports

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. Should `ToolContext` include `triggerEvent: CommittedEvent` so tools can see what triggered the invocation?
2. Is `execute` correctly always-async (`Promise<TOutput>`), or should it also allow synchronous returns (`TOutput | Promise<TOutput>`)?
3. Is the `emit` → `BaseEvent` pattern correct (tools emit drafts, framework commits), or should tools emit through a different mechanism?
