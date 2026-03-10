# Task 04 — Observation Event Definitions

**Phase:** 1 (Foundational Primitives)
**Depends on:** Nothing (uses existing event factory patterns)
**Blocks:** Tasks 08, 12
**Parallelizable with:** Tasks 03, 05

---

## Objective

Define the framework-provided observation events under `Ductus.events.*`. These are `EventDefinition` instances created using the existing `signal()` and `event()` factory utilities. They represent agent, skill, and tool lifecycle events that processors can consume for monitoring, logging, and auditing.

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/utils/event-utils.ts` — the `event()`, `signal()`, and `intent()` factory functions
- `src/utils/internals.ts` — `createEventFactory()` which they delegate to
- `src/core/events.ts` — the existing `BootEvent` definition (pattern to follow)
- `src/utils/schema-utils.ts` — the `string()`, `number()`, `object()`, `boolean()`, `array()` schema helpers
- `src/interfaces/event.ts` — `Volatility`, `EventDefinition`, `BroadcastableEventDefinition`

Confirm you understand:
- `signal(type, payloadShape)` creates a volatile event (broadcast but not persisted)
- `event(type, payloadShape)` creates a durable event (persisted to ledger)
- Payload shapes are Zod-based strict objects defined using `src/utils/schema-utils.ts` helpers
- Events follow the naming convention `Ductus/EventName`

---

## 2. Implementation

### 2.1 Create `src/events/observation-events.ts`

Define all framework-provided observation events. Use `signal()` for events that are volatile by default (most observation events). The user can override volatility on the agent's `.observe()` call, but the definition's default volatility is what matters here.

**Events to define:**

**Agent-level (volatile by default):**
- `AgentInvoked` — agent started working. Payload: `{ agent: string, skill: string, inputHash: string }`
- `AgentCompleted` — agent finished successfully. Payload: `{ agent: string, skill: string, durationMs: number, tokenUsage: { input: number, output: number } }`
- `AgentFailed` — agent invocation failed. Payload: `{ agent: string, skill: string, error: string }`
- `AgentReplaced` — agent hit lifetime limit, replaced via handoff. Payload: `{ agent: string, reason: string }`
- `AgentStreamChunk` — raw streaming chunk for real-time observation. Payload: `{ agent: string, skill: string, chunkType: string, content: string }`

**Skill-level (volatile by default):**
- `SkillInvoked` — skill invocation started. Payload: `{ agent: string, skill: string }`
- `SkillCompleted` — skill completed, output validated. Payload: `{ agent: string, skill: string, durationMs: number }`
- `SkillFailed` — skill failed after exhausting retries. Payload: `{ agent: string, skill: string, error: string, retriesExhausted: boolean }`
- `SkillRetry` — skill output rejected, retrying. Payload: `{ agent: string, skill: string, attempt: number, maxRetries: number, error: string }`

**Tool-level (volatile by default):**
- `ToolRequested` — agent requested tool execution. Payload: `{ agent: string, tool: string, arguments: string }`
- `ToolCompleted` — tool execution completed. Payload: `{ agent: string, tool: string, durationMs: number }`

Use the `Ductus/` prefix for all event type strings (e.g., `'Ductus/AgentInvoked'`).

Use `signal()` for all definitions (volatile by default). The agent's observation config can later override specific events to be durable.

### 2.2 Export from `src/events/observation-events.ts`

All events must be named exports. Additionally, export a namespace-like object:

```typescript
export const observationEvents = {
  AgentInvoked,
  AgentCompleted,
  AgentFailed,
  AgentReplaced,
  AgentStreamChunk,
  SkillInvoked,
  SkillCompleted,
  SkillFailed,
  SkillRetry,
  ToolRequested,
  ToolCompleted,
}
```

This object will later be exposed as `Ductus.events` in `src/factories.ts` (Task 12).

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Verify each event definition can be called as a factory function with the correct payload shape, and that `.is()` method works for type guarding.
- Verify all events have `volatility: 'volatile'` (from `signal()`).
- Verify all type strings use the `Ductus/` prefix.
- No test file is required for this task (event factories are already tested by the existing test suite), but verify manually that one sample event can be constructed:
  ```typescript
  const e = AgentCompleted({ agent: 'eng', skill: 'impl', durationMs: 500, tokenUsage: { input: 100, output: 200 } })
  // e.type === 'Ductus/AgentCompleted'
  // e.volatility === 'volatile'
  ```

---

## 4. Report

After completing the task, provide:
- The file created
- Full list of event names and their type strings
- Confirmation that `npx tsc --noEmit` passes

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] All 11 events are defined
- [ ] All use `signal()` (volatile)
- [ ] All type strings use `Ductus/` prefix
- [ ] Payload shapes use schema helpers from `schema-utils.ts` (`string()`, `number()`, `boolean()`, `object()`)
- [ ] `tokenUsage` in `AgentCompleted` is a nested object `{ input: number, output: number }`
- [ ] The `observationEvents` aggregate object is exported
- [ ] Each event is also a named export (for tree-shaking)
- [ ] No circular imports

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. Are the payload shapes complete? Is any field missing that the framework would need during emission?
2. Should `AgentStreamChunk` include the full `AgentChunk` object in its payload, or just `chunkType` + `content`?
3. Should `ToolCompleted` include a `resultSummary` field, or is that too domain-specific?
4. Is the `Ductus/` prefix the right namespace convention?
