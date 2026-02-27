# Task: 016-development-processor

**Global References:** 
- `rfc-001.implementation-guide.md` (MUST READ for Config interpolation logic)
- `rfc-001.revision-06.md` (Section 5.3 The Bouncer Validation Loop)

## 1. Objective & Responsibility
Implement the `DevelopmentProcessor` (Zero-Trust Loop). The most critical processor for codebase integrity. It intercepts Agent reports and acts as The Bouncer. It queries the Operating System to verify the Agent's claims against physical reality before allowing work to progress. It also owns all dynamic prompt interpolation for shell verification commands (Linters, Tests).

## 2. Invariants & Global Contracts (The Happy Path)
- **The Zero-Trust Invariant:** The most critical check in the architecture. When an Engineer Agent reports completing a task and claims to have edited `['auth.ts']`, the `DevelopmentProcessor` MUST unconditionally yield an `EFFECT_RUN_TOOL` targeting `git diff --name-only`. It must mathematically compare the output of Git with the array of files claimed by the Agent.
- **The Automatic Rejection Inference:** If the `git diff` output has *any* files missing from the Agent's claims, or files included that were *not* claimed by the Agent, it constitutes a hallucination. The processor MUST immediately short-circuit and yield `AUTO_REJECTION`.

## 3. I/O Boundaries & Dependencies
- **No Direct Execution:** This processor cannot run `git` itself via `execa`. It MUST coordinate perfectly with the `ToolProcessor` by yielding `EFFECT_RUN_TOOL` events and listening for the subsequent `TOOL_COMPLETED` events. It must use the Hub sequence or event IDs to correlate tool responses to the original verification tracks.
- **The Configuration Registry:** It requires the active `DuctusConfig` passed via constructor to look up exactly which arbitrary checks (e.g. `npm run test {{files}}`) to execute for the active scope.

## 4. Exact Event Signatures (Contract Adherence)
- **Listens To:** `AGENT_REPORT_RECEIVED`, `TOOL_COMPLETED`.
- **Yields (Durable):** `EFFECT_RUN_TOOL`, `AUTO_REJECTION`, `VALIDATION_SUCCESS`.

## 5. Lifecycle & Unhappy Path
- **Muted Mode Protection:** Standard hydration rules apply. Ignore incoming tasks if `isReplay: true`. We cannot re-execute previous shell verifications during startup.
- **Check Failures:** If `git diff` passes securely, the processor runs the configured lint/test commands via the `ToolProcessor`. If the `TOOL_COMPLETED` event from the test execution contains a non-zero exit code (`status: 'failure'`), the processor MUST yield `AUTO_REJECTION` pinpointing exactly which shell command failed, along with the appended stderr for the Agent to fix.

## 6. Required Execution Constraints
- Manage an internal lookup Map to track pending verification flows (e.g., mapping `eventId` of an `EFFECT_RUN_TOOL` back to the Agent's original `files` array).
- Implement raw string interpolation logic. When a configured check contains `{{files}}`, perform a literal string replace using `.join(' ')` of the successfully verified git diff array before yielding the final string to the `ToolProcessor`.

## 7. Definition of Done
1. **The True Hallucination Proof:** Yield an `AGENT_REPORT_RECEIVED` claiming `["a.ts"]`. Yield a mocked `TOOL_COMPLETED` response for the git diff tracking ID containing `["a.ts", "b.ts"]`. Assert that the processor immediately intercepts the mismatch and yields an `AUTO_REJECTION` event to trigger the quarantine protocol.
2. **The Interpolation Proof:** Supply a mock config with the check `npx eslint {{files}}`. Simulate a successful git diff for `["x.ts"]`. Assert that the subsequent `EFFECT_RUN_TOOL` string yielded to the hub is exactly `npx eslint x.ts`.
