# S02 — Decompose the Agent Dispatcher

**Phase:** 2 (Architecture)
**Depends on:** S00, S01
**Blocks:** S03, S04, S05

---

## Why This Task Exists

This is the single most important task in the entire RFC. The motivation section (1.4) opens with:

> *"AgentDispatcher manages agent lookup, lifecycle state, prompt composition, template rendering, interceptor pipeline, adapter lifecycle, handoff context, and turn tracking — all tangled in one 520-line class."*

The RFC's architectural prescription was clear: decompose the dispatcher into focused components that each own one concern. What actually happened is that the V2 path (`invokeAndParseV2`, `getOrCreateLifecycleStateV2`, `enforceLifecycleLimitsV2`, `enforceContextPolicy`, `resolveContextPolicy`) was bolted onto the existing class, growing it to 703 lines. After S00 deletes the V1 path, the dispatcher will be shorter — but it will still be a single class with 5+ concerns tangled together.

**The goal of this task is NOT to "make it shorter." It is to extract focused, testable, single-purpose components that the dispatcher delegates to.**

The dispatcher should become a thin coordinator — a facade that calls into extracted modules for prompt composition, lifecycle management, context policy enforcement, and invocation orchestration. Each concern gets its own file, its own tests, and its own contract.

---

## 1. Exploration

After S00 and S01, catalog every remaining responsibility in `AgentDispatcher`:

1. **Agent lookup** — `this.agents.get(agentName)` map
2. **Prompt composition** — `composeSystemMessage()`, `formatPrompt()`, `resolvePersona()`, `resolveSystemPrompt()`
3. **Lifecycle state management** — `getOrCreateLifecycleState()` (now the V2 version renamed), lazy init of transport + conversation
4. **Lifecycle limit enforcement** — `enforceLifecycleLimits()` (now the V2 version renamed), failures/hallucinations/turns reset logic
5. **Context policy enforcement** — `enforceContextPolicy()`, `resolveContextPolicy()`
6. **Invocation orchestration** — `invokeAndParse()` (now the V2 version renamed), calling `invokeAgent()`, collecting observation events
7. **Transport checking** — `hasTransport()` (renamed from `hasV2Transport`)
8. **Shutdown** — `terminateAll()`

Read the full dispatcher after S00+S01 are complete. Understand the dependency graph between these concerns.

---

## 2. Implementation

### 2.1 Extract Prompt Composer — `src/core/agent-prompt-composer.ts`

**What it owns:** Composing the full system message from an agent's persona, systemPrompt, rules, rulesets, and template rendering.

**Why separate:** Prompt composition is a pure transformation — given an agent config, a template renderer, a file adapter, and a system adapter, produce a string. It has zero coupling to lifecycle, invocation, or context policies. It accesses no mutable state. Other parts of the system may need to compose system messages independently (e.g., context policy reset, future handoff logic).

Extract these methods into a standalone class or set of functions:
- `composeSystemMessage(agentConfig: AgentEntity): Promise<string>`
- `formatPrompt(...)` (private helper)
- `resolvePersona(...)` (private helper)
- `resolveSystemPrompt(...)` (private helper)
- `awaitRendered(...)` (trivial helper)

The constructor takes `TemplateRenderer`, `FileAdapter`, `SystemAdapter`, and `Injector` — the same dependencies the dispatcher currently passes to these methods.

**Important design constraint:** The current `resolveSystemPrompt()` renders templates with `state: this.store.getState()` — pulling live application state. If we give the composer a `StoreAdapter` reference, it becomes coupled to the runtime store, violating the RFC's separation-of-concerns principle. Instead, `compose()` should accept `state` as a parameter. The caller (dispatcher or lifecycle manager) passes the current state at call time. The composer stays stateless.

```typescript
export class AgentPromptComposer {
  constructor(
    private readonly templateRenderer: TemplateRenderer,
    private readonly fileAdapter: FileAdapter,
    private readonly systemAdapter: SystemAdapter,
    private readonly injector: Injector,
  ) {}

  async compose(agent: AgentEntity, state: unknown): Promise<string> { ... }
}
```

The caller passes `this.store.getState()` when calling `compose()`. The composer never holds a store reference.

### 2.2 Extract Lifecycle Manager — `src/core/agent-lifecycle-manager.ts`

**What it owns:** Creating, storing, and resetting lifecycle state for agents. Determining when an agent's lifecycle limits are exceeded and resetting state.

**Why separate:** Lifecycle management is stateful bookkeeping. It tracks tokens, failures, hallucinations, turns, and turn records per agent. It decides when to reset. This concern is orthogonal to how invocation works — the lifecycle manager doesn't care about transports, conversations, or tools. It just tracks counters and enforces thresholds.

Extract:
- The `lifecycle` map (`Map<string, AgentLifecycleState>`)
- `getOrCreateLifecycleState(agentName: string, agentConfig: AgentEntity, ...) → AgentLifecycleState`
- `enforceLifecycleLimits(agentName: string, state: AgentLifecycleState, agentConfig: AgentEntity) → void`
- `terminateAll() → Promise<void>` (the transport close loop)

The lifecycle manager needs access to `AgentPromptComposer` (for reset — recomposing the system message) and must create `ConversationImpl` and resolve transport on first use.

```typescript
export class AgentLifecycleManager {
  private readonly lifecycle: Map<string, AgentLifecycleState> = new Map()

  constructor(
    private readonly agents: Map<string, AgentTuple>,
    private readonly promptComposer: AgentPromptComposer,
  ) {}

  async getOrCreate(agentName: string): Promise<AgentLifecycleState> { ... }
  async enforceLimits(agentName: string, state: AgentLifecycleState, agentConfig: AgentEntity): Promise<void> { ... }
  async terminateAll(): Promise<void> { ... }
}
```

### 2.3 Extract Context Policy Enforcer — `src/core/agent-context-policy.ts`

**What it owns:** Resolving the context policy from agent config (string shortcut → concrete policy instance), applying the policy when `tokenEstimate >= maxContextTokens`.

**Why separate:** Context policy resolution and enforcement is a strategy pattern. It maps string names to implementations and delegates to the chosen strategy. It's a pure function of (agentConfig, state, model) → new conversation. Zero coupling to lifecycle counters or invocation orchestration.

Extract:
- `resolveContextPolicy(agentConfig: AgentEntity): ContextPolicy`
- `enforceContextPolicy(agentConfig: AgentEntity, state: AgentLifecycleState, model?: string): Promise<void>`

```typescript
export function resolveContextPolicy(agentConfig: AgentEntity): ContextPolicy { ... }

export async function enforceContextPolicy(
  agentConfig: AgentEntity,
  state: AgentLifecycleState,
  model?: string,
): Promise<void> { ... }
```

These can be standalone functions — they need no instance state.

### 2.4 Slim down `AgentDispatcher` to coordinator

After extraction, the dispatcher becomes a thin facade:

```typescript
export class AgentDispatcher<TState> {
  private readonly agents: Map<string, AgentTuple>
  private readonly promptComposer: AgentPromptComposer
  private readonly lifecycleManager: AgentLifecycleManager
  private readonly store: StoreAdapter<TState>
  private readonly injector: Injector
  private lastKnownSequence = 0

  constructor(options: AgentDispatcherOptions<TState>) {
    // Build agents map
    // Create promptComposer
    // Create lifecycleManager
  }

  hasTransport(agentName: string): boolean { ... }

  async invokeAndParse(agentName: string, skillName: string, input: unknown): Promise<{
    output: unknown
    observationEvents: BaseEvent[]
  }> {
    // 1. Look up agent + skill
    // 2. lifecycleManager.getOrCreate(agentName)
    // 3. lifecycleManager.enforceLimits(...)
    // 4. enforceContextPolicy(agentConfig, state, model)
    // 5. Call invokeAgent(...)
    // 6. Update state with results
    // 7. Return output + observation events
  }

  async terminateAll(): Promise<void> {
    await this.lifecycleManager.terminateAll()
  }
}
```

### 2.5 Update `AgentDispatcherOptions`

The options interface should reflect the new construction. Remove dependencies that are now owned by extracted components:
- Remove `interceptors` (V1 — gone from S00)
- `templateRenderer`, `fileAdapter`, `systemAdapter` still needed for constructing `AgentPromptComposer`

### 2.6 Update tests

- Existing tests in `src/__tests__/agentic-integration.test.ts` and `src/__tests__/v2-reaction-e2e.test.ts` should still pass — the external API of `AgentDispatcher` is unchanged
- Add unit tests for each extracted component:
  - `src/__tests__/agent-prompt-composer.test.ts` — test prompt composition in isolation
  - `src/__tests__/agent-lifecycle-manager.test.ts` — test lifecycle creation, limits enforcement, reset logic
  - `src/__tests__/agent-context-policy.test.ts` — test policy resolution and enforcement (can reuse parts of existing `context-policies.test.ts`)

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- `npx jest` — must pass
- **Line count check:** `agent-dispatcher.ts` must have FEWER lines than the combined extracted files. The dispatcher itself should be under 100 lines.
- **Concern count:** The dispatcher should have exactly 3 responsibilities: agent lookup, invocation orchestration (delegating to extracted components), and shutdown. Everything else lives in extracted modules.

---

## 4. Structural Constraints (reviewer MUST reject if violated)

- `AgentDispatcher` is over 150 lines → REJECT
- `AgentDispatcher` directly contains prompt composition logic → REJECT
- `AgentDispatcher` directly contains lifecycle state management logic (beyond delegation) → REJECT
- `AgentDispatcher` directly contains context policy resolution logic → REJECT
- Any extracted component depends on `AgentDispatcher` (circular dependency) → REJECT
- External callers (`internals.ts`, `factories.ts`) need to change their calling code → REJECT (the facade API must remain the same)
- `AgentPromptComposer` holds a reference to `StoreAdapter` → REJECT (state must be passed as a parameter to `compose()`, not stored as a dependency)

---

## 5. Report

- Files created (list every new file)
- Files modified
- Line count of `agent-dispatcher.ts` before and after
- Number of responsibilities remaining in `agent-dispatcher.ts`
- Test results (all suites)

---

## 6. Self-Review

- [ ] `AgentPromptComposer` exists as a standalone class in its own file
- [ ] `AgentLifecycleManager` exists as a standalone class in its own file
- [ ] Context policy resolution exists as standalone functions in their own file
- [ ] `AgentDispatcher` delegates to all extracted components
- [ ] `AgentDispatcher` has no private methods for prompt composition
- [ ] `AgentDispatcher` has no private methods for lifecycle state bookkeeping (beyond updating counters)
- [ ] `AgentDispatcher` has no private methods for context policy resolution
- [ ] All existing tests pass unchanged
- [ ] New unit tests exist for each extracted component
- [ ] No circular dependencies between new files
- [ ] `AgentPromptComposer` does NOT hold a `StoreAdapter` reference — state is passed to `compose()`
- [ ] `agent-dispatcher.ts` is under 150 lines
