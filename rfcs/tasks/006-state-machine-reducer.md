# Task: 006-state-machine-reducer

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Pure Determinism and Zero I/O overrides)
- `rfc-001.revision-06.md` (Section 8.3 The Full State Lifecycle)

## 1. Objective & Responsibility
Implement the pure, mathematical Core Logic (The Memory & Limbic System). This replaces XState. You are to build a purely functional Reducer `(State, Event) -> [NewState, PendingEffects]` that maintains the exact global lifecycle (Negotiating -> Planning -> Tasking -> Coding -> Verifying -> Done).

## 2. Invariants & Global Contracts (The Happy Path)
- **Mathematical Determinism:** If you pass the exact same State tree and the exact same `CommitedEvent` to this reducer one million times, it MUST return the exact same output tuple one million times. 
- **Pure Functional Yield:** The Reducer DOES NOT put events on the Hub. It calculates what *should* happen next, returning an array of new `BaseEvent` side-effects. The `StateMachineProcessor` wrapping this pure function is responsible for I/O routing.
- **Mutation Forbidden:** You MUST NEVER mutate the `State` parameter. You must return a shallow (or deep, if necessary) clone representing the next tick.

## 3. I/O Boundaries & Dependencies
- **Zero I/O Allowable:** This file must not import anything other than TypeScript Types. No `fs`, no `crypto`, no `Date.now()`, no `Math.random()`. Contextual randomness or time must come entirely from the `Event` payload.

## 4. Exact Event Signatures (Contract Adherence)
- **Input Argument:** `CommitedEvent<ProcessorEvent>`
- **Output Tuple:** `[StateMachineContext, BaseEvent<any, any>[]]`
- **Listens To (Examples):** `AUTO_REJECTION`, `PLAN_APPROVED`, `TASKS_GENERATED`, `TOOL_COMPLETED`.
- **Calculates (Examples):** `EFFECT_SPAWN_AGENT`, `EFFECT_RUN_TOOL`, `KILL_AGENT`.

## 5. Lifecycle & Unhappy Path
- **Threshold Escalation:** If the incoming event is `AUTO_REJECTION`, the reducer must increment `state.hallucinations`. If `state.hallucinations` strictly exceeds the config threshold limit, it MUST calculate a `KILL_AGENT` and `HALLUCINATION_DETECTED` effect array instead of a normal retry, enforcing the Quarantine Protocol.
- **Panic State:** If the event is `EMERGENCY_STOP` or `CIRCUIT_INTERRUPTED`, force the state status to 'failed' and clear all active task arrays instantly.

## 6. Required Execution Constraints
- Define the `StateMachineContext` interface strictly, tracking `status`, `hallucinations`, `rejections`, and the active `tasks` array.
- Structure the reducer as a broad `switch(event.type)`.
- Export cleanly defined initial "Genesis" state tree constants.

## 7. Definition of Done
1. **The Pure Clone Proof:** Write a test asserting that `ductusReducer(mockState, mockEvent)[0] !== mockState` (referential inequality proves a new clone was returned).
2. **The Hallucination Threshold Proof:** Provide a mock state where `hallucinations == 4`. Provide a config stating `maxRecognizedHallucinations: 5`. Fire an `AUTO_REJECTION`. Assert the new state is returned with `hallucinations: 5` and NO `KILL_AGENT`. Fire a second `AUTO_REJECTION`. Assert the new state returns `KILL_AGENT` in the effects array.
