# Task 12 — Reaction Pipeline and Flow Integration

**Phase:** 4 (Integration)
**Depends on:** Tasks 04 (observation events), 07 (skill builder), 08 (agent builder), 11 (dispatcher decomposition)
**Blocks:** Task 13, Task 14
**Parallelizable with:** Partially with Task 13

---

## Objective

Wire all the new components into the existing framework entry points:
1. Update `src/utils/internals.ts` — `createReactionAdapter` and `executePipeline` to work with the refactored dispatcher and yield observation events
2. Update `src/interfaces/builders/flow-builder.ts` and `src/builders/immutable-flow-builder.ts` — flow-level model/transport overrides on `.agent()`
3. Update `src/factories.ts` — add `Ductus.tool()` factory, export `Ductus.events.*`, update `kernel()` function
4. Update `src/interfaces/entities/flow-entity.ts` — update agent registration to support new model/transport structure

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/utils/internals.ts` — `createReactionAdapter()` and `executePipeline()` (lines 76-163)
- `src/factories.ts` — all factory functions and the `kernel()` function (full file)
- `src/interfaces/builders/flow-builder.ts` — current flow builder interface
- `src/builders/immutable-flow-builder.ts` — current flow builder implementation
- `src/interfaces/entities/flow-entity.ts` — `FlowEntity` with `agents` array
- `src/core/agent-dispatcher.ts` — the refactored dispatcher (Task 11)
- `src/events/observation-events.ts` — `observationEvents` object (Task 04)
- `src/interfaces/builders/tool-builder.ts` — `ToolBuilder` (Task 06)
- `src/builders/immutable-tool-builder.ts` — `ImmutableToolBuilder` (Task 06)
- `src/interfaces/entities/agent-entity.ts` — `AgentEntity` with `defaultModel`, `defaultTransport`

Confirm you understand:
- How `createReactionAdapter()` bridges reactions to the dispatcher
- How `kernel()` assembles the `AgentDispatcher` and creates the `DuctusKernel`
- The current `FlowEntity.agents` shape: `Array<{ agent, model, adapter }>`
- How the flow builder's `.agent()` method currently works
- That observation events yielded from processors flow through the multiplexer like any other event

---

## 2. Implementation

### 2.1 Update `src/interfaces/entities/flow-entity.ts`

The agent registration in `FlowEntity` needs to support the new model: agents may bring their own model/transport (from `defaultModel`/`defaultTransport`), and the flow can override them.

Update the agents array type. Keep backward compatibility — the old `adapter` field becomes optional, new `transport` field is added:

```typescript
import { AgentEntity } from './agent-entity.js'
import { ModelEntity } from './model-entity.js'
import { AdapterEntity } from './adapter-entity.js'
import { AgentTransport } from '../agent-transport.js'
import { ReactionEntity } from './reaction-entity.js'
import { ReducerEntity } from './reducer-entity.js'
import { ProcessorEntity } from './processor-entity.js'

export interface FlowAgentRegistration {
  agent: AgentEntity
  model?: ModelEntity
  transport?: AgentTransport
  adapter?: AdapterEntity  // deprecated, for backward compat
}

export interface FlowEntity<TState> {
  initialState: TState
  reducer: ReducerEntity<TState>
  agents: FlowAgentRegistration[]
  reactions: Array<ReactionEntity>
  processors: Array<ProcessorEntity<TState>>
}
```

### 2.2 Update `src/interfaces/builders/flow-builder.ts`

Modify the `.agent()` method to support the new registration pattern:

```typescript
// Add this overload alongside the existing one:
agent(
  agent: AgentBuilder,
  overrides?: { model?: ModelBuilder | ModelEntity; transport?: AgentTransport },
): FlowBuilder<TState>
```

The existing `.agent(agent, model, adapter)` signature should remain for backward compatibility.

### 2.3 Update `src/builders/immutable-flow-builder.ts`

Implement the new `.agent()` overload:
- If called with overrides object, use the overrides for model/transport
- If overrides are not provided, the agent's `defaultModel` and `defaultTransport` are used (resolved at kernel time)
- If called with the old 3-arg pattern (agent, model, adapter), work as before
- Store registrations as `FlowAgentRegistration` objects

### 2.4 Update `src/utils/internals.ts`

**`createReactionAdapter()`:**
- The dispatcher's `invokeAndParse()` may now return observation events alongside the result
- If the dispatcher returns observation events, yield them from the processor (they flow through the multiplexer)
- This depends on how Task 11 surfaces observation events — adapt accordingly

**`executePipeline()`:**
- No changes to the pipeline step logic (invoke, map, assert, case, emit, error)
- The invoke step still calls `dispatcher.invokeAndParse()` — the dispatcher internally handles tools, retries, and observation

### 2.5 Update `src/factories.ts`

**Add `Ductus.tool()` factory:**

```typescript
function tool(name: string): ToolBuilder {
  return new ImmutableToolBuilder().name(name)
}
```

**Add `Ductus.events` export:**

```typescript
import { observationEvents } from './events/observation-events.js'
```

**Update `kernel()` function:**
- Update to work with `FlowAgentRegistration` instead of `{ agent, model, adapter }`
- Resolve model/transport for each agent: `registration.model ?? agent.defaultModel`, `registration.transport ?? agent.defaultTransport`
- Pass resolved transports to the `AgentDispatcher`

**Update the default export object:**

```typescript
export default {
  // ... existing entries ...
  tool,
  events: observationEvents,
}
```

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Verify all existing sample2 tests still pass:
  - `npx tsx sample2/tests/state`
  - `npx tsx sample2/tests/backpressure/block`
  - `npx tsx sample2/tests/backpressure/fail`
  - `npx tsx sample2/tests/backpressure/throttle`
  - `npx tsx sample2/tests/concurrency`
- Verify the flow builder accepts both old-style `.agent(agent, model, adapter)` and new-style `.agent(agent)` and `.agent(agent, { model, transport })`.
- Verify `Ductus.tool('name')` returns a `ToolBuilder`.
- Verify `Ductus.events.AgentCompleted` is an `EventDefinition`.
- Run existing jest tests: `npx jest`

---

## 4. Report

After completing the task, provide:
- List of files modified
- Confirmation that `npx tsc --noEmit` passes
- Results of all sample2 tests
- Results of jest tests
- Any backward compatibility issues found and how they were resolved

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] `FlowEntity.agents` uses `FlowAgentRegistration[]` (backward compatible)
- [ ] Flow builder `.agent()` supports both old (3-arg) and new (overrides object) patterns
- [ ] `Ductus.tool()` factory is exported and returns `ToolBuilder`
- [ ] `Ductus.events` is exported and contains all 11 observation events
- [ ] `kernel()` correctly resolves model/transport from agent defaults + flow overrides
- [ ] `createReactionAdapter()` can yield observation events from the dispatcher
- [ ] `executePipeline()` is unchanged in its step logic
- [ ] All sample2 tests pass (existing behavior preserved)
- [ ] All jest tests pass
- [ ] No new circular imports
- [ ] Backward compatibility: existing code using `.agent(agent, model, adapter)` still works

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. **Flow builder overloads:** is the `.agent()` method overloaded correctly? Can TypeScript distinguish between `(agent, model, adapter)` and `(agent, { model, transport })`?
2. **Kernel model resolution:** the priority chain `flow override → agent default → ???`. What happens if neither provides a model/transport and the agent has skills?
3. **Observation event yielding:** are observation events yielded from the reaction processor alongside domain events? Does this interfere with the pipeline's data flow?
4. **Sample2 backward compat:** do the sample2 tests use old-style adapter registration? Do they still work?
5. **Import organization:** does adding `observationEvents` and `ImmutableToolBuilder` to `factories.ts` make the import list too large?
