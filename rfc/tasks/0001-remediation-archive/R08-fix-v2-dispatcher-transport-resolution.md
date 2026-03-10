# R08 — Fix V2 Dispatcher Transport Resolution (Flow-Level Override)

**Severity:** HIGH
**Audit ref:** H10
**Depends on:** None
**Blocks:** None

---

## Problem

`getOrCreateLifecycleStateV2` in `src/core/agent-dispatcher.ts` (line 573) only checks `tuple.agent.defaultTransport`. Per RFC Section 5.3, the flow can override transport via `FlowAgentRegistration.transport`. This field exists on the entity but the dispatcher never consults it.

---

## 1. Exploration

- `src/core/agent-dispatcher.ts` — `getOrCreateLifecycleStateV2()`, `AgentDispatcherOptions`
- `src/interfaces/entities/flow-entity.ts` — `FlowAgentRegistration.transport`
- `src/factories.ts` — `kernel()` function, how agents are passed to the dispatcher

Note: The dispatcher currently receives `AgentTuple[]` (V1 only). V2 agents are filtered out in `kernel()`. The dispatcher needs access to `FlowAgentRegistration` data to resolve flow-level transport.

---

## 2. Implementation

### 2.1 Pass flow-level transport to the dispatcher

Modify `AgentDispatcherOptions` to accept V2 registrations alongside V1 tuples:

```typescript
export interface AgentDispatcherOptions<TState> {
  agents: AgentTuple[]
  agentsV2?: FlowAgentRegistration[]  // new
  // ... existing fields
}
```

### 2.2 Update `kernel()` to pass V2 registrations

In `src/factories.ts`, pass all flow agent registrations (not just adapter-filtered ones) to the dispatcher.

### 2.3 Update transport resolution order

In `getOrCreateLifecycleStateV2`, resolve transport with this priority:
1. Flow-level `registration.transport` (if present)
2. Agent's `defaultTransport`
3. Throw (no transport available)

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Test that an agent with no `defaultTransport` but with a flow-level transport works correctly
- Run existing tests

---

## 4. Self-Review

- [ ] Flow-level transport override is consulted before agent default
- [ ] V2 registrations are passed to the dispatcher
- [ ] Agents with no transport at either level throw a descriptive error
- [ ] Backward compat preserved for V1 agents
