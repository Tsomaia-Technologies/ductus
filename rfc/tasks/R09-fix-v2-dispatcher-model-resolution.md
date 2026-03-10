# R09 — Fix V2 Dispatcher Model Resolution

**Severity:** HIGH
**Audit ref:** H11
**Depends on:** R08
**Blocks:** None

---

## Problem

`invokeAndParseV2` in `src/core/agent-dispatcher.ts` (line 534) passes `tuple.model` to `invokeAgent`. But for V2-style registrations, `model` is optional on both `FlowAgentRegistration` and `AgentTupleV2`. The dispatcher does not fall back to `agent.defaultModel`. If neither flow nor agent provides a model, `tuple.model` is undefined and `invokeAgent` receives an undefined model.

---

## 1. Exploration

- `src/core/agent-dispatcher.ts` — `invokeAndParseV2()` model resolution
- `src/core/agent-invocation.ts` — `invokeAgent` model resolution chain: `skillConfig.model ?? agent.defaultModel ?? options.model`
- `src/interfaces/entities/agent-entity.ts` — `AgentEntity.defaultModel`

---

## 2. Implementation

### 2.1 Resolve model with fallback chain

In `invokeAndParseV2`, resolve the model with:
1. Flow-level `registration.model` (from R08's V2 registration data)
2. Agent's `agent.defaultModel`
3. Throw descriptive error ("Agent has no model configured")

Pass the resolved model to `invokeAgent` via the `model` option. Note that `invokeAgent` has its own internal resolution (`skillConfig.model ?? agent.defaultModel ?? options.model`), so the dispatcher should pass the best available default.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Test that an agent with `defaultModel` but no flow-level model works
- Test that a flow-level model overrides the agent's `defaultModel`
- Run existing tests

---

## 4. Self-Review

- [ ] Model resolution follows: flow-level → agent default → error
- [ ] `invokeAgent` receives a valid model
- [ ] Per-skill model overrides in `invokeAgent` still work (they override the default)
- [ ] Descriptive error when no model is available
