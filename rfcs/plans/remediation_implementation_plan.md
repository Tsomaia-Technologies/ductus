# Ductus v2 Remediation Rewrite ("Ship of Theseus")

The current Ductus v2 codebase violates the pure stream pipeline architecture required by the RFCs. The MultiplexerHub was incorrectly injected into process constructors, turning isolated async generators into tightly coupled event emitters (`this.hub.broadcast`). Furthermore, the engine is physically incapable of running because nothing iterates the `process(stream)` generators.

This plan details the surgical steps to burn down the tainted wiring and cleanly salvage the internal logic.

## User Review Required

> [!IMPORTANT]
> As the acting System Architect, I am strictly in read-only mode and **will not make any code changes**. This blueprint defines the architectural migration plan for you or another engineer to follow. Please confirm if this execution order meets your expectations.

## Proposed Changes

### 1. Burn Down & Establish the Pure Spine
The deeply tainted core networking must be removed and rewritten cleanly as pure generators without side effects. The duplicated event contracts must also be centralized and refactored.

#### [DELETE] `src/interfaces/event-processor.ts`
#### [DELETE] `src/core/multiplexer-hub.ts`
#### [DELETE] `src/bootstrapper/bootstrapper.ts`
#### [DELETE] `src/core/event-contracts.ts`

#### [NEW] `src/interfaces/event.ts`
- Must be the single source of truth for `BaseEvent` and `CommitedEvent`. Fix the spelling to `CommittedEvent`. Remove specific domain events from here.

#### [NEW] `src/interfaces/event-queue.ts`
- Fix imports to rely solely on `src/interfaces/event.ts`.

#### [NEW] `src/core/events/types.ts`
- Centralize all concrete domain event definitions extending `BaseEvent`.

#### [NEW] `src/core/events/creators.ts`
- Implement pure factory functions for all defined event types to strictly enforce the `volatility` flag assignment.

#### [NEW] `src/core/events/schemas.ts`
- Store `zod` runtime schemas used for hydration parsing.

#### [NEW] `src/interfaces/event-processor.ts`
- Must enforce strict pipeline logic: `process(stream: InputEventStream): OutputEventStream`.
- Hub injection is explicitly prohibited.

#### [NEW] `src/core/multiplexer-hub.ts`
- Implement strictly binding `MultiplexerHub`. Must track sequence numbers and emit cryptographically locked `Object.freeze()` events, completely agnostic of processor generation.

#### [NEW] `tests/core/yield-harness.ts`
- Prove the loop physically spins using `for await`. A mock processor yields `TICK` to demonstrate standard node stream functionality without deadlocking.

---

### 2. Salvage The Brain (State Machine)
The State Machine was written but completely orphaned from the engine. 

#### [DELETE] `src/core/state-machine-reducer.ts`

#### [NEW] `src/core/state-machine-reducer.ts`
- Re-implement or migrate as a pure function: `(state, event) => [newState, effects]`.

#### [NEW] `src/processors/state-machine-processor.ts`
- Create a new Processor that wraps the pure reducer. Ingests events from the Hub stream, mutates local `currentState`, and `yield`s computed effects back.

---

### 3. Surgical Processor Remediation
Salvaging the robust internal logic written strictly into pure `yield` architectures.

#### [MODIFY] `src/processors/agent-processor.ts`
#### [MODIFY] `src/processors/development-processor.ts`
#### [MODIFY] `src/processors/tool-processor.ts`
#### [MODIFY] `src/processors/*.ts` (all 10 Processors)
- **Action:** Excise `private readonly hub: AgentHub` from all constructors.
- **Action:** Regex/Refactor replace all instances of `this.hub.broadcast({ ... })` with `yield { ... }`.
- Validate that `process()` behaves as a standard `AsyncIterable<DuctusEvent>`.

---

### 4. Re-Hydrate the Bootstrapper
Reconnecting the spine safely. 

#### [NEW] `src/bootstrapper/bootstrapper.ts`
- Hand-write the explicit `for await (const outEvent of processor.process(hub.subscribe()))` blocks.
- Incorporate `SilentMode` for JSONL replay hydration.
- Enforce strict blocking transition to `LiveMode` exclusively after `fileAdapter.readStream()` has entirely ended.


## Verification Plan

### Automated Tests
- Run `npm run test` targeting `tests/core/yield-harness.ts` to mathematically prove the generators are iterated and do not hang the Node process.

### Manual Verification
- Execute `ductus run` and run the **"Drop Test"** (force-quit the CLI midway into planning/execution). Restart `ductus run` and verify it flashes through past events using `SilentMode` hydration and resumes precisely without re-triggering LLM calls.
