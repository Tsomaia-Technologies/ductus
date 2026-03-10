# R01 — Emit Observation Events from invokeAgent

**Severity:** CRITICAL
**Audit ref:** C2
**Depends on:** R00
**Blocks:** R02

---

## Problem

The 11 observation events are defined in `src/events/observation-events.ts` but `invokeAgent` never emits any of them. The `onEvent` callback is only invoked when tools call `ctx.emit()`. The framework itself never emits `AgentInvoked`, `AgentCompleted`, `AgentFailed`, `SkillInvoked`, `SkillCompleted`, `SkillFailed`, `SkillRetry`, `ToolRequested`, `ToolCompleted`, or `AgentStreamChunk`. Per RFC Section 10 steps 3 and 6, the framework must emit these during the invocation sequence.

---

## 1. Exploration

Read and understand:

- `src/core/agent-invocation.ts` — the full `invokeAgent`, `runToolLoop`, `executeTool` functions
- `src/events/observation-events.ts` — all 11 event definitions and their payload shapes
- `src/interfaces/observation-config.ts` — `ObservationConfig`, `ObservationEntry`
- `src/interfaces/entities/agent-entity.ts` — `AgentEntity.observation`
- RFC Section 10 — the invocation sequence with observation emission points
- RFC Section 11 — observation model, volatility, opt-in

Identify every point in the invocation sequence where an observation event should be emitted.

---

## 2. Implementation

### 2.1 Add observation config to `InvocationOptions`

Add to `InvocationOptions`:
```typescript
observation?: ObservationConfig
```

### 2.2 Create observation helper

Create a helper function (inside `agent-invocation.ts` or a new `src/core/observation-emitter.ts`) that checks whether a given event should be emitted based on the agent's `ObservationConfig`:

```typescript
function shouldEmit(
  eventDef: BaseEventDefinition,
  config: ObservationConfig | undefined,
  skillName?: string,
): boolean
```

Logic:
- If `config.observeAll` is true → emit
- If `config.events` includes this event definition → emit
- If the event is skill-scoped and `config.skillEvents` includes a matching skill with no event filter or matching event filter → emit
- Otherwise → do not emit

### 2.3 Emit events at correct points in `invokeAgent`

**Before tool loop starts (per skill invocation):**
- Emit `SkillInvoked` with `{ agent, skill }`

**In `runToolLoop`, before executing each tool:**
- Emit `ToolRequested` with `{ agent, tool, arguments }`

**In `runToolLoop`, after executing each tool:**
- Emit `ToolCompleted` with `{ agent, tool, durationMs }`

**In `runToolLoop`, on each chunk (if `AgentStreamChunk` is observed):**
- Emit `AgentStreamChunk` with `{ agent, skill, chunkType, content }`

**After successful output parsing + assertion:**
- Emit `SkillCompleted` with `{ agent, skill, durationMs }`
- Emit `AgentCompleted` with `{ agent, skill, durationMs, tokenUsage }`

**On retry:**
- Emit `SkillRetry` with `{ agent, skill, attempt, maxRetries, error }`

**On final failure (retries exhausted):**
- Emit `SkillFailed` with `{ agent, skill, error, retriesExhausted: true }`
- Emit `AgentFailed` with `{ agent, skill, error }`

### 2.4 Respect volatility

Each emitted event should carry the volatility from the observation config entry, or default to `'volatile'`.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Update `src/__tests__/agentic-integration.test.ts` to verify observation events are emitted:
  - Test A: verify `ToolRequested`, `ToolCompleted`, `SkillInvoked`, `SkillCompleted`, `AgentCompleted` appear in `onEvent` callbacks
  - Test B: verify `SkillRetry` appears
  - Test C: verify `SkillFailed` and `AgentFailed` appear
- Run all existing tests

---

## 4. Report

- Files modified/created
- Which events are emitted at which points
- Test results

---

## 5. Self-Review

- [ ] All 11 observation event types have emission points
- [ ] Events are only emitted if the agent's observation config opts in
- [ ] Volatility is respected per event
- [ ] `durationMs` is calculated correctly (start time captured before invocation)
- [ ] Observation events flow through `onEvent` callback
- [ ] Tests verify event emission
- [ ] No performance impact when observation is not configured

---

## 6. Manual Review Request

Highlight:
1. Are events emitted at the correct sequence points per RFC Section 10?
2. Is the opt-in check correct for all observation config patterns (observeAll, per-event, per-skill)?
3. Does volatility propagation work correctly?
