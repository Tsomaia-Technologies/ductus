# Remediation Plan: Salving Ductus v2

**Status:** ACTIVE
**Objective:** Surgically gut the dead architectural wiring created by the Agents, wire the engine properly using `AsyncIterable` stream yields, and salvage their internal domain logic.

## The Problem
The Agents generated 111 files that contain excellent internal logic (e.g., git diff parsing, cache adapter maps, Zod configuration schemas) but catastrophically failed the Inversion of Control wiring. The Processors illegally import the Hub and call `.broadcast()`, meaning the system is a tightly coupled command dispatcher instead of a pure Reactive Event Sourcing engine. Furthermore, the `process(stream)` generators are never iterated, leaving the engine entirely dead.

## The Strategy: The "Ship of Theseus" Rewrite
Do **NOT** tell the agents to "fix it." They will get confused and hallucinate bizarre workarounds. 
We must explicitly burn down the core wiring, establish a rigid, mathematical test harness for the pure loop, and *then* copy-paste their salvaged logic back into the pure `yield` blocks.

---

## Phase 1: Burn Down & Establish the Pure Spine

1. **Delete Core Interfaces:** 
   - Delete `src/interfaces/event-processor.ts`. It is tainted.
   - Delete `src/core/multiplexer-hub.ts`.
   - Delete `src/bootstrapper/bootstrapper.ts`.
2. **Execute New Tasks 001, 002, 003:**
   - Feed the newly hardened `rfcs/tasks/001-core-event-contracts.md`, `002-multiplexer-hub.md`, and `003-adapter-interfaces.md` back to the agents (or implement manually).
   - **Crucial Rule:** The `EventProcessor` interface MUST NOT provide access to the `Hub`. It strictly maps `AsyncIterable<Incoming> -> AsyncIterable<Outgoing>`.
3. **The Yield Harness:**
   - Before proceeding to actual processors, write a dummy script that creates the Hub, registers a mock processor that yields `TICK`, and explicitly calls:
     ```typescript
     for await (const outEvent of processor.process(hub.subscribe())) {
         hub.broadcast(outEvent);
     }
     ```
   - Prove the loop actually spins infinitely.

## Phase 2: Salvage The Brain (State Machine)

1. **Delete the State Machine Reducer:**
   - Nuke `src/core/state-machine-reducer.ts`. The agents wrote a good reducer but failed to wire it.
2. **Execute New Task 006 (State Machine Reducer):**
   - Provide `rfcs/tasks/006-state-machine-reducer.md`. Ensure it remains a pure `(state, event) => [state, effects]` function.
3. **Build the `StateMachineProcessor` (Missing from Original Agent Gen):**
   - We must create a new physical stream processor that wraps the pure reducer. 
   - It listens to the Hub, feeds incoming events statefully into the Reducer, updates its internal `currentState` wrapper, and `yield`s the calculated effects array back to the Hub.

## Phase 3: Surgical Processor Remediation

We will go through the existing `src/processors/*.ts` files one by one.

**The Operation (For every Processor):**
1. Remove `private readonly hub: AgentHub` from the `constructor`.
2. Delete every instance of `this.hub.broadcast({ ... })`.
3. Replace them strictly with `yield { ... }`.
4. Ensure the class strictly implements `process(stream): AsyncIterable<OutputEvent>`.

*Salvage Priority:*
- **AgentProcessor:** Salvage the `AbortController` mapping and Moxite template parsing. Just swap `.broadcast` with `yield`.
- **DevelopmentProcessor:** Salvage the `git diff` regex and `interpolateFiles` logic. 
- **ToolProcessor:** Salvage the `execa` wrapper mapping and timeouts.

## Phase 4: Re-Hydrate the Bootstrapper

1. **Execute New Task 008 (Bootstrapper):**
   - Provide `rfcs/tasks/008-bootstrapper.md`.
   - The bootstrapper is responsible for explicitly instantiating the `for await` loops that bind the processors to the Hub.
   - It restores the `SilentMode` JSONL hydration, ensuring `LiveMode` is not flipped until the `fileAdapter.readStream` completely resolves.

## Execution Orders

Do not allow agents to work in parallel on Phase 1 & 2. 
You must approve the mathematical purity of the `MultiplexerHub` and the `StateMachineReducer` *before* ordering the Agents to surgically modify `src/processors/*`.
