# Event Provenance & Causality Strictness Plan

## Goal Description
Establish a mathematically sound, unforgeable event provenance envelope by shifting causality and identity tracking from optional payload heuristics to structurally enforced framework guarantees. We will close the "fate loophole" by requiring an `ActorIdentity`, a `causationId`, and a `correlationId` on all committed events. We will achieve absolute observability without compromising Developer Experience (DX) by implementing implicit context propagation boundaries at the application perimeter.

## Core Philosophical Rules
1. **Zero-Trust Accountability**: The framework assumes nothing. Every state mutation must present a verified architectural "badge" (ActorIdentity) to the ledger.
2. **Deterministic Graphing**: Downstream reducers and routing mechanisms must never rely on defensive `if (event.author)` checks. If an event is on the ledger, its causality and identity fields are guaranteed natively.
3. **No Silent Fallbacks**: If the framework cannot identify the actor initiating a root event, it must fatally throw. Lazily defaulting to `'system'` breaks the audit chain.

---

## Proposed Changes

### 1. Enforcing Provenance in Interfaces

#### [MODIFY] `src/interfaces/event.ts`
- Introduce the `ActorIdentity` discriminated union to enforce contextual typology:
  ```typescript
  export type ActorIdentity = 
    | { type: 'system' }
    | { type: 'agent', name: string, instanceId: string }
    | { type: 'user', id: string }
    | { type: 'anonymous' };
  ```
- Update `CommittedEvent` to make the causality and identity graph mandatory:
  ```typescript
  export type CommittedEvent<TEvent extends BaseEvent> = TEvent & {
    eventId: string
    isCommited: true
    hash: string
    timestamp: number
    // Provenance Envelope explicitly required
    causationId: string
    correlationId: string
    actor: ActorIdentity
  }
  ```

### 2. Implicit Context Propagation (The DX Interface)

#### [NEW] `src/interfaces/ductus-context.ts`
Create the interface that bridges the framework to the developer's application layer logic regarding identity.
  ```typescript
  export interface ExecutionContext {
    actor: ActorIdentity;
    correlationId?: string;
  }

  export interface DuctusContextProvider {
    getContext(): ExecutionContext | undefined;
  }
  ```

#### [MODIFY] `src/core/ductus-multiplexer.ts`
- Inject the optional `DuctusContextProvider` via `DuctusMultiplexerOptions`.
- Update the `broadcast(event, explicitContext)` method signature. 
- **Root Resolution & Identity Stamping**: When `broadcast` mints a new `CommittedEvent`, it applies strict resolution logic:
  1. Priority 1: Check `explicitContext.actor` (used internally by Dispatcher and Kernel).
  2. Priority 2: Check `this.contextProvider.getContext()?.actor` (implicitly resolved from Node's `AsyncLocalStorage` setup by the developer).
  3. Action: If no actor is resolved, `throw new Error('Ductus Framework: Provenance violation.')`.
  4. Root markers:
     - `causationId = context.causationId ?? '$root'`
     - `correlationId = context.correlationId ?? eventId`

### 3. Context Propagation via Infrastructure

#### [MODIFY] `src/core/agent-dispatcher.ts`
- When the Dispatcher relays an event yielded by an `AgentAdapter`, it intercepts the broadcast call and injects the context explicitly, overriding any implicit thread context:
  - `actor: { type: 'agent', name: agentName, instanceId: state.instanceId }`
  - `causationId`: The `eventId` of the trigger that woke the agent.
  - `correlationId`: Inherited from the trigger.

#### [MODIFY] `src/core/ductus-kernel.ts`
- Update the cascading loop in `mountStore`. When `store.dispatch` returns secondary cascade events, the Kernel MUST broadcast them with context inherited from the catalyst event:
  - `causationId = incomingEvent.eventId`
  - `correlationId = incomingEvent.correlationId`
  - `actor = incomingEvent.actor` (Secondary structural cascades operate under the authorization of the actor who triggered the primary state change).

---

## Verification Plan

### Automated Tests
1. **TypeScript Compiler**: After modifying `CommittedEvent`, all downstream usages in tests and processors will flag compilation errors if they aren't properly propagating the mandatory ID strings.
2. **Multiplexer Tests (`src/__tests__/ductus-multiplexer.baseline.test.ts`)**:
   - Assert that broadcasting with no explicit context and no injected `DuctusContextProvider` results in an immediate synchronous throw.
   - Assert that an injected `DuctusContextProvider` correctly stamps the resulting `CommittedEvent` with the returned `ActorIdentity`.
3. **Kernel Tests (`src/__tests__/ductus-kernel.baseline.test.ts`)**:
   - Assert that cascading events routed back into the multiplexer by the store perfectly inherit the `actor`, `causationId`, and `correlationId` from the parent event.
4. **Dispatcher Tests (`src/__tests__/agent-dispatcher.baseline.test.ts`)**:
   - Assert that events yielded by an agent are stamped explicitly with `{ type: 'agent' }`, ignoring any external context provider state.
