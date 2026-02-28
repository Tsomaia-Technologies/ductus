# Task: 017-planning-processor

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Event Pipeline constraints)
- `rfc-001.revision-06.md` (Section 5.2 The Food Chain Workflow)

## 1. Objective & Responsibility
Implement the `PlanningProcessor`. This is the initial node of the prefrontal cortex workflow. It dictates the initialization of the `PlannerRole` agent and governs the negotiation phase. Once the user provides the initial prompt instruction, this processor translates it into a structured technical specification (`SPEC.md`).

## 2. Invariants & Global Contracts (The Happy Path)
- **Role Isolation:** The Planning processor is strictly hard-coded to invoke the `planner` Role. It lacks authorization to summon any other agents.
- **Interaction Loop:** The Planning processor does not unilaterally decide the spec is final. It yields `EFFECT_SPAWN_AGENT`, receives the `AGENT_REPORT` containing the draft spec, and subsequently yields `REQUEST_INPUT` so the human reviewer can definitively approve or reject the draft via the `InputProcessor`.

## 3. I/O Boundaries & Dependencies
- **Strictly Conceptual:** No direct Adapters or external configuration injections are required. It relies entirely on consuming event structs from the Hub and emitting response structs.

## 4. Exact Event Signatures (Contract Adherence)
- **Listens To:** `START_PLANNING`, `INPUT_RECEIVED`.
- **Yields (Durable):** `EFFECT_SPAWN_AGENT`, `REQUEST_INPUT`, `PLAN_APPROVED`, `PLAN_REJECTED`.

## 5. Lifecycle & Unhappy Path
- **Hydration Sync:** Honors `isReplay: true` silently dropping logic.
- **The Redaction Loop:** If an `INPUT_RECEIVED` event returns from the user stating "No, add authentication to the spec", the Processor MUST catch this rejection, and yield a fresh `EFFECT_SPAWN_AGENT` back to the Hub, appending the user's explicit rejection text into the context array for the Planner agent to attempt revision 2.

## 6. Required Execution Constraints
- Manage a standard state tracker using `eventId`s to map pending `INPUT_RECEIVED` events to the correct draft `SPEC.md`.
- Ensure that when the User answers "Yes" to the draft spec, the processor yields the final, locked `PLAN_APPROVED` event, including the full text of the approved specification. This signals the Type Machine Reducer to exit the `planning` phase and enter the `tasking` phase.

## 7. Definition of Done
1. **The Approval Relay Test:** Yield an `INPUT_RECEIVED` mapped to a valid session where `answer === "Yes"`. Assert that the Processor immediately yields `PLAN_APPROVED` containing the associated spec string payload, terminating the planning cycle.
