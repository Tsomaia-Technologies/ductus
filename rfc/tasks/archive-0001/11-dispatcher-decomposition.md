# Task 11 — Agent Dispatcher Decomposition

**Phase:** 3 (Core Runtime)
**Depends on:** Task 03 (Conversation class), Task 05 (context policies), Task 09 (output parser), Task 10 (agent invocation engine)
**Blocks:** Task 12
**Sequential:** Must be completed after Task 10

---

## Objective

Refactor the existing `AgentDispatcher` (520 lines, 8+ concerns) to use the new components: `Conversation`, `AgentTransport`, `invokeAgent()`, context policies, and observation events. The dispatcher becomes a coordinator that delegates to focused components rather than doing everything itself.

This task does NOT delete `AgentDispatcher` — it rewires its internals. External callers (`createReactionAdapter` in `internals.ts`) continue to call the same methods. Breaking the external API is deferred to Task 12.

---

## 1. Exploration

Before writing any code, read and understand these files thoroughly:

- `src/core/agent-dispatcher.ts` — the ENTIRE file (all 521 lines). Understand every method.
- `src/core/agent-invocation.ts` — the `invokeAgent()` function (Task 10)
- `src/core/conversation.ts` — the `Conversation` class (Task 03)
- `src/core/context-policies/index.ts` — all context policy implementations (Task 05)
- `src/core/output-parser.ts` — `parseAgentOutput()` (Task 09)
- `src/interfaces/entities/agent-entity.ts` — modified `AgentEntity` with `defaultModel`, `defaultTransport`, `contextPolicy`, `observation`
- `src/interfaces/agent-lifecycle.ts` — `AgentLifecycleState`, `AgentTuple`, `TurnRecord`
- `src/interfaces/context-policy.ts` — `ContextPolicy`, `ContextPolicyName`
- `src/events/observation-events.ts` — framework observation events (Task 04)
- `src/utils/internals.ts` — `createReactionAdapter()` which creates the call bridge

Map the current dispatcher's responsibilities:
1. **Agent lookup** — `this.agents.get(agentName)` → unchanged
2. **Lifecycle state management** — `getOrCreateLifecycleState()` → must be updated to use `Conversation` instead of `adapter.initialize()`
3. **Lifecycle limit enforcement** — `enforceLifecycleLimits()` → must use context policies instead of always replacing
4. **Prompt composition** — `composeSystemMessage()`, `formatPrompt()`, `resolvePersona()`, `resolveSystemPrompt()` → unchanged
5. **Interceptor pipeline** — `executePipeline()` inside `invokeContext()` → being replaced by `invokeAgent()`
6. **Adapter replacement** — `replaceAdapter()` → must be updated for transport-based model
7. **Token/turn tracking** — scattered in `invokeContext()` → must use `InvocationResult.tokenUsage`
8. **Handoff context rendering** — `replaceAdapter()` → unchanged in concept, updated for new data model

---

## 2. Implementation

### 2.1 Update `AgentLifecycleState` in `src/interfaces/agent-lifecycle.ts`

The lifecycle state must now hold a `Conversation` and an `AgentTransport` instead of an `AgentAdapter`.

Add a new interface alongside the existing one (do not break existing code yet — Task 13 handles deprecation):

```typescript
import { Conversation } from './conversation.js'
import { AgentTransport } from './agent-transport.js'

export interface AgentLifecycleStateV2 {
  tokensUsed: number
  failures: number
  hallucinations: number
  turns: number
  transport: AgentTransport
  conversation: Conversation
  turnRecords: TurnRecord[]
  currentTurnStartSequence: number
}
```

### 2.2 Modify `src/core/agent-dispatcher.ts`

Refactor the dispatcher's internals. Keep the external method signatures (`invoke`, `invokeAndParse`, `invokeContext`, `terminateAll`) the same for now.

**Key changes:**

**a) Lifecycle initialization (`getOrCreateLifecycleState`):**
- Instead of `adapter.create()` + `adapter.initialize(context)`:
  - Resolve the transport: `agent.defaultTransport ?? tuple.adapter?.create(agent, model)` (fallback to old adapter for backward compat)
  - Create a `Conversation`: `Conversation.create(systemMessage)`
  - Store `{ transport, conversation, ... }` in lifecycle state

**b) Invocation (`invokeAndParse`):**
- Instead of the old interceptor pipeline + `adapter.process()` + `adapter.parse()`:
  - Call `invokeAgent()` from Task 10 with the current conversation, transport, tools, etc.
  - Update lifecycle state with the returned conversation and token usage
  - Return the parsed output

**c) Context policy enforcement:**
- Before each invocation, check if `conversation.tokenEstimate >= agent.maxContextTokens`
- If so, resolve the context policy:
  - If `agent.contextPolicy` is a string, instantiate the corresponding policy class
  - Call `policy.apply(conversation, limit, transport)` to get a new conversation
  - For `'replace'` policy, also trigger handoff (existing behavior)
- Update lifecycle state with the new conversation

**d) Observation event emission:**
- After a successful invocation, check `agent.observation` config
- If the agent has opted in to `AgentCompleted`, call `onEvent` with the event
- The `onEvent` mechanism needs to be wired to the multiplexer (via the processor's yield). For now, collect observation events and return them alongside the result. The caller (`createReactionAdapter`) will yield them.

**e) Adapter replacement (`replaceAdapter`):**
- Update to close the old transport (`transport.close()`) instead of `adapter.terminate()`
- Create a new transport and conversation for the replacement

**f) Turn tracking:**
- Update using `InvocationResult.tokenUsage` instead of parsing usage chunks manually

### 2.3 Do NOT modify external callers yet

`createReactionAdapter` in `src/utils/internals.ts` continues to call `dispatcher.invokeAndParse()`. Task 12 will update this.

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Existing tests in `src/__tests__/agent-dispatcher.baseline.test.ts` should still pass (the external API is unchanged). If they use internal mocking of `AgentAdapter`, they may need adaptation — document any test changes.
- Verify the dispatcher correctly initializes conversations on first invocation.
- Verify context policy enforcement runs before each invocation.
- Verify the tool loop (via `invokeAgent`) works end-to-end through the dispatcher.
- Verify `terminateAll()` calls `transport.close()` on all active transports.

---

## 4. Report

After completing the task, provide:
- List of files modified
- Summary of changes to each method in `AgentDispatcher`
- Confirmation that `npx tsc --noEmit` passes
- Status of existing tests (pass/fail/adapted)
- Any backward compatibility concerns identified

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] External API unchanged: `invoke()`, `invokeAndParse()`, `terminateAll()` have the same signatures
- [ ] Lifecycle state uses `Conversation` instead of adapter-managed messages
- [ ] Context policy is resolved and applied before each invocation
- [ ] `invokeAgent()` is called with correct parameters (conversation, transport, tools, model, skill, input)
- [ ] Returned conversation from `invokeAgent()` is stored back in lifecycle state
- [ ] Token usage from `InvocationResult` updates `state.tokensUsed`
- [ ] Turn records are updated correctly
- [ ] `terminateAll()` calls `.close()` on transports
- [ ] Handoff/replacement creates a new transport and fresh conversation
- [ ] Prompt composition (persona, systemPrompt, rules) still works correctly
- [ ] The dispatcher handles the case where `agent.defaultTransport` is undefined (backward compat with old adapters)
- [ ] No observation events are emitted yet (just collected) — Task 12 wires emission

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. **Backward compatibility:** can the dispatcher still work with old-style `AdapterEntity` + `AgentAdapter` for agents that haven't been migrated?
2. **Context policy resolution:** is the string → policy class mapping hardcoded or configurable?
3. **Observation event collection:** the dispatcher collects events but doesn't emit them. Is this the right intermediate step, or should emission be wired now?
4. **Conversation ownership:** the dispatcher stores conversation in lifecycle state and passes it to `invokeAgent()`. Is there a risk of the conversation getting out of sync?
5. **Handoff with conversation:** when the agent is replaced, the handoff template still needs access to events from the ledger. Is this compatible with the new conversation model?
6. **Overall complexity:** is the refactored dispatcher manageable, or should it be further decomposed into separate classes (LifecycleManager, ContextPolicyEnforcer, etc.)?
