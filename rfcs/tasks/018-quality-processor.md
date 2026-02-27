# Task: 018-quality-processor

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Configuration injection)
- `rfc-001.revision-06.md` (Section 8.2 The Verification Agent)

## 1. Objective & Responsibility
Implement the `QualityProcessor`. Once the `DevelopmentProcessor` has successfully merged and tested all individual micro-tasks in a feature, the `QualityProcessor` acts as the final gatekeeper (The Feature Reviewer). It operates at the macro-level, running holistic suite tests and invoking the `AuditorRole` agent to compare the entire finalized Codebase State directly against the original `SPEC.md`.

## 2. Invariants & Global Contracts (The Happy Path)
- **The Holistic Mandate:** Unlike the `DevelopmentProcessor` which runs checks marked `per_iteration` or `per_task`, the `QualityProcessor` MUST seek out and execute checks explicitly flagged in the configuration as `boundary: 'per_feature'` (e.g. heavy end-to-end Cypress test suites, complete Type-checking). These are deliberately delayed until this final phase to save computational resources.

## 3. I/O Boundaries & Dependencies
- **Configuration Aware:** It requires the active `DuctusConfig` passed via constructor to accurately identify and filter the `per_feature` diagnostic commands.
- **Tool Handoff:** Identical to the Dev Processor, it must yield events to the `ToolProcessor` to physically run the suite tests.

## 4. Exact Event Signatures (Contract Adherence)
- **Listens To:** `FEATURE_IMPLEMENTED`, `TOOL_COMPLETED`, `AGENT_REPORT_RECEIVED`.
- **Yields (Durable):** `EFFECT_RUN_TOOL`, `EFFECT_SPAWN_AGENT`, `FEATURE_REJECTED`, `FEATURE_APPROVED`.

## 5. Lifecycle & Unhappy Path
- **Hydration Immunity:** Honors `isReplay: true` silently dropping logic.
- **Remediation Trigger:** If the heavy `per_feature` tools fail, or the `AuditorRole` agent finds functional gaps missing from the `SPEC.md`, the `QualityProcessor` MUST yield a `FEATURE_REJECTED` event. This event MUST encapsulate the specific test failures or the Auditor's critique. The State Machine Reducer fundamentally relies on this signal to dramatically revert the architecture back to the `Coding` phase and kick off a new remediation loop.

## 6. Required Execution Constraints
- Map incoming Tool responses to their tracked commands. 
- Ensure that the execution of `per_feature` tools is completed successfully *before* evaluating whether the LLM Auditor needs to be spawned. Do not waste LLM tokens if the physical E2E tests are red.

## 7. Definition of Done
1. **The Feature Escalation Proof:** Supply a mock `DuctusConfig` containing a `boundary: 'per_feature'` check for `npm run e2e`. Yield the `FEATURE_IMPLEMENTED` trigger. Assert that the `QualityProcessor` accurately locates the 'per_feature' checks and yields the matching `EFFECT_RUN_TOOL`, entirely ignoring properties marked `per_task`.
