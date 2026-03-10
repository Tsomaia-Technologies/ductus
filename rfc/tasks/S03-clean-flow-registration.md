# S03 — Clean Up Flow Registration and Pipeline Integration

**Phase:** 3 (Integration)
**Depends on:** S01, S02, S02b
**Blocks:** S04

---

## Why This Task Exists

After S00 deletes the V1 adapter path, the flow builder and `kernel()` factory still carry the scar tissue of the transition:

1. **Flow builder has a dead overload.** `FlowBuilder.agent()` still has the 3-arg signature `(agent, model, adapter)` — but `AdapterBuilder` no longer exists after S00. The builder interface and implementation carry dead code for an API that can't be called.

2. **`kernel()` factory hacks `flowTransport` onto a deprecated tuple.** Line 200-207 of `factories.ts` builds `AgentTuple` with a `flowTransport` field that was a backward-compatibility shim. After S01 renames `AgentTuple` to the clean version, the tuple construction should build `AgentTuple` directly without the `flowTransport` hack.

3. **`FlowEntity.agents` has an optional `adapter?` field.** `FlowAgentRegistration` in `flow-entity.ts` still has `adapter?: AdapterEntity`. That type no longer exists.

4. **`executePipeline` has a dead V1 branch.** In `internals.ts`, the `invoke` case branches on `dispatcher.hasTransport()`: if true, use V2 path; if false, use `dispatcher.invokeAndParse()` (the old V1 collect-and-parse). After S00, there IS no V1 path. Every agent has a transport. The branch is dead code.

5. **`FlowBuilder` imports `AdapterBuilder`.** After S00, this import is broken.

These are not cosmetic issues. Dead overloads confuse users. Dead branches hide bugs (the "else" case of a dead branch is unreachable code that still appears in coverage). The flow registration API should reflect the actual architecture: agents come with model and transport, not model and adapter.

---

## 1. Exploration

Read:
- `src/interfaces/builders/flow-builder.ts` — the flow builder interface
- `src/builders/immutable-flow-builder.ts` — the flow builder implementation
- `src/interfaces/entities/flow-entity.ts` — `FlowAgentRegistration`, `FlowEntity`
- `src/factories.ts` — `kernel()` function, agent tuple construction
- `src/utils/internals.ts` — `executePipeline()`, the `invoke` case with the dead V1 branch

Understand what each file looks like AFTER S00 and S01 are applied. Some of these may already be partially cleaned by S00 (e.g., import removals), but the structural cleanup belongs here.

---

## 2. Implementation

### 2.1 Clean `FlowAgentRegistration` in `src/interfaces/entities/flow-entity.ts`

Remove the `adapter?: AdapterEntity` field. Remove the `AdapterEntity` import.

The registration should be:

```typescript
export interface FlowAgentRegistration {
  agent: AgentEntity
  model?: ModelEntity
  transport?: AgentTransport
}
```

**Why `model` stays optional:** An agent can declare `defaultModel()`. The flow can override it. If neither provides a model, it's a configuration error caught at invocation time — not at registration time. This flexibility is by design (RFC 15.9).

**Why `transport` stays optional:** Same reasoning. An agent can declare `defaultTransport()`. The flow can override it. Resolution happens at lifecycle initialization.

### 2.2 Clean `FlowBuilder` in `src/interfaces/builders/flow-builder.ts`

Remove the dead 3-arg overload `agent(agent, model, adapter)`. Remove the `AdapterBuilder` import.

The builder should have one clean signature:

```typescript
agent(
  agent: AgentBuilder,
  overrides?: { model?: ModelBuilder | ModelEntity; transport?: AgentTransport },
): this
```

**Why this signature:** The overrides object is optional. If omitted, the agent uses its own `defaultModel` and `defaultTransport`. If provided, the flow overrides them. This matches RFC Section 7 (Flow Registration).

### 2.3 Clean `ImmutableFlowBuilder` in `src/builders/immutable-flow-builder.ts`

Remove the 3-arg `.agent()` handling. Simplify to only handle the new-style registration.

### 2.4 Clean `kernel()` in `src/factories.ts`

Replace the tuple construction:

**Before (with hack):**
```typescript
const agentTuples = flow.agents
  .filter(a => a.adapter !== undefined || a.transport !== undefined || a.agent.defaultTransport !== undefined)
  .map(a => ({
    agent: a.agent,
    model: a.model!,
    adapter: a.adapter,
    flowTransport: a.transport,
  }))
```

**After (clean):**
```typescript
const agentTuples = flow.agents
  .filter(a => a.transport !== undefined || a.agent.defaultTransport !== undefined)
  .map(a => ({
    agent: a.agent,
    model: a.model,
    transport: a.transport,
  }))
```

No more `adapter`, no more `flowTransport`, no more `model!` non-null assertion. The tuple is now `AgentTuple` (the clean version from S01).

**Important:** S02 changed `AgentDispatcherOptions` — it may now require different constructor arguments since the dispatcher delegates to `AgentPromptComposer` and `AgentLifecycleManager`. Verify that `kernel()` passes the correct options to the `AgentDispatcher` constructor. If S02 made the dispatcher construct its internal components from the same options (which it should — the facade pattern means the constructor takes the same or similar inputs), then `kernel()` needs no additional changes beyond tuple cleanup. If S02 changed the options shape, update `kernel()` accordingly.

Read the post-S02 `AgentDispatcherOptions` before implementing this section. Do not assume it is unchanged.

### 2.5 Remove dead V1 branch from `executePipeline` in `src/utils/internals.ts`

The `invoke` case currently branches:

```typescript
if (dispatcher.hasTransport(step.agent.name)) {
  // V2 path
} else {
  // V1 path — DEAD CODE after S00
}
```

After S00, every registered agent has a transport. Remove the branch entirely. The invoke case should unconditionally call `dispatcher.invokeAndParse(...)` (the renamed V2 method from S01):

```typescript
case 'invoke':
  lastAgent = step.agent
  lastSkill = step.skill
  const result = await dispatcher.invokeAndParse(
    step.agent.name,
    step.skill.name,
    lastInvokeResult,
  )
  lastInvokeResult = result.output
  for (const obsEvent of result.observationEvents) {
    yield obsEvent
  }
  break
```

Also remove the `hasTransport()` method from `AgentDispatcher` entirely if it's now unused (since we no longer branch on it). However, keep it if it's useful for runtime validation (e.g., checking if an agent was registered). Make a judgment call — if it adds no value, delete it.

### 2.6 Clean imports across all modified files

After all changes, verify no file imports deleted types (`AdapterBuilder`, `AdapterEntity`, etc.).

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- `npx jest` — must pass
- `grep -r "AdapterBuilder" src/ --include="*.ts"` — zero results
- `grep -r "AdapterEntity" src/ --include="*.ts"` — zero results
- `grep -r "flowTransport" src/ --include="*.ts"` — zero results
- `grep -r "hasTransport\|hasV2Transport" src/ --include="*.ts"` — zero results (unless kept for a valid reason, documented)

---

## 4. Anti-Goals (reviewer MUST reject if any are true)

- The 3-arg `.agent(agent, model, adapter)` overload still exists
- `FlowAgentRegistration` still has an `adapter` field
- `kernel()` still constructs tuples with `flowTransport` or `adapter`
- `executePipeline` still branches on V1 vs V2
- Any dead import of deleted types remains

---

## 5. Report

- Files modified (list every one)
- Dead code removed (lines before/after per file)
- Grep results confirming zero references to dead types
- Test results

---

## 6. Self-Review

- [ ] `FlowAgentRegistration` has only `agent`, `model?`, `transport?`
- [ ] `FlowBuilder.agent()` has one clean signature
- [ ] `kernel()` builds clean tuples matching the new `AgentTuple`
- [ ] `kernel()` passes correct options to `AgentDispatcher` constructor (accounting for S02's changes)
- [ ] `executePipeline` has no V1 branch
- [ ] No dead imports
- [ ] All tests pass
