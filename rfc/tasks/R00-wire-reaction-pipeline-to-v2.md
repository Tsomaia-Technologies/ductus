# R00 — Wire Reaction Pipeline to V2 Invocation Path

**Severity:** CRITICAL
**Audit ref:** C1
**Depends on:** None (existing code is ready)
**Blocks:** R01, R02

---

## Problem

`executePipeline` in `src/utils/internals.ts` calls `dispatcher.invokeAndParse()` — the old V1 path that uses the deprecated `AgentAdapter`. The V2 path (`invokeAndParseV2` → `invokeAgent`) is implemented but never reached by reactions. A user writing `Ductus.reaction().invoke(Engineer, Skill)` goes through the old adapter with no tools, no assertions, no retries, no conversation, and no observations.

---

## 1. Exploration

Read and understand:

- `src/utils/internals.ts` — `createReactionAdapter()` and `executePipeline()`
- `src/core/agent-dispatcher.ts` — both `invokeAndParse()` (V1) and `invokeAndParseV2()` (V2)
- `src/core/agent-invocation.ts` — `invokeAgent()` and `InvocationResult`
- `src/interfaces/entities/reaction-entity.ts` — `InvokeStep`, `PipelineContext`

Identify the exact call site where V1 is invoked and what must change to route to V2 instead.

---

## 2. Implementation

### 2.1 Update `executePipeline` in `src/utils/internals.ts`

The `invoke` case (line 124-131) currently calls:
```typescript
lastInvokeResult = await dispatcher.invokeAndParse(
  step.agent.name,
  step.skill.name,
  lastInvokeResult,
)
```

Change to call the V2 path:
```typescript
const { output, observationEvents } = await dispatcher.invokeAndParseV2(
  step.agent.name,
  step.skill.name,
  lastInvokeResult,
)
lastInvokeResult = output
```

### 2.2 Determine V1 vs V2 routing

Not all agents will have V2 transports configured. The dispatcher must handle this gracefully:

- If the agent has a `defaultTransport` (or flow-level transport), use `invokeAndParseV2`
- If the agent only has a V1 adapter, fall back to `invokeAndParse`

Add a method to `AgentDispatcher` such as `hasV2Transport(agentName: string): boolean` that checks whether the agent should use the V2 path. Update `executePipeline` to branch accordingly.

### 2.3 Yield observation events from the pipeline

`invokeAndParseV2` returns `observationEvents: BaseEvent[]`. These need to be yielded from `executePipeline` so they flow through the multiplexer:

```typescript
for (const obsEvent of observationEvents) {
  yield obsEvent
}
```

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Write a test or verify manually that a reaction with `.invoke()` routes through `invokeAndParseV2` when the agent has a transport configured
- Verify backward compatibility: agents registered with the old 3-arg form (agent, model, adapter) still route through `invokeAndParse`
- Run existing tests to confirm no regressions

---

## 4. Report

- Files modified
- Which code path each agent registration style takes (V1 vs V2)
- Confirmation of backward compat

---

## 5. Self-Review

- [ ] `executePipeline` calls V2 path for agents with transport
- [ ] `executePipeline` falls back to V1 for adapter-only agents
- [ ] Observation events are yielded from the pipeline
- [ ] `lastAgent` and `lastSkill` are still tracked for `PipelineContext`
- [ ] All existing tests pass

---

## 6. Manual Review Request

Highlight:
1. Is the V1/V2 branching logic correct and future-proof?
2. Are observation events yielded at the right point in the pipeline?
3. Does backward compat work correctly for existing adapter-based agents?
