# RFC 0001 — Structural Remediation Tasks

These tasks address the core architectural goals of RFC 0001 that were never completed during the initial implementation pass. The initial pass implemented interfaces, builders, and behavioral logic correctly but failed to execute the structural transformation: the `AgentDispatcher` was never decomposed, V1 code was never removed, and the flow registration was never cleaned up.

## Tasks

| ID | Title | Phase | Depends On | Status |
|----|-------|-------|------------|--------|
| S00 | Delete the V1 Adapter Path | 1 (Demolition) | — | Pending |
| S01 | Rename V2 to Canonical Names | 1 (Demolition) | S00 | Pending |
| S02 | Decompose the Agent Dispatcher | 2 (Architecture) | S00, S01 | Pending |
| S03 | Clean Up Flow Registration and Pipeline | 3 (Integration) | S01, S02 | Pending |
| S04 | Clean Up Public Exports | 3 (Integration) | S00-S03 | Pending |
| S05 | Full Kernel-Booted E2E Test | 4 (Verification) | S02, S03, S04 | Pending |

## Execution Order

**Strictly sequential.** Each task depends on the one before it. No parallelization.

```
S00 → S01 → S02 → S03 → S04 → S05
```

### Phase 1 — Demolition (S00, S01)

Remove dead code. Rename survivors. Zero behavioral change. The framework must work identically before and after, with fewer files and no V2 suffixes.

### Phase 2 — Architecture (S02)

The single most important task. Decompose the `AgentDispatcher` into focused components. The dispatcher becomes a thin coordinator under 150 lines.

### Phase 3 — Integration (S03, S04)

Clean up the flow registration, pipeline, and public exports to reflect the new architecture. Remove dead overloads, dead branches, dead imports.

### Phase 4 — Verification (S05)

A full kernel-booted E2E test that exercises the entire stack: domain event → reaction → agent invocation → tool execution → observation events → domain event emission → state reduction. This is the acid test.

## Key Principles

Every task brief includes a **"Why This Task Exists"** section. Engineers must read it before writing code. The architectural intent is as important as the implementation steps.

**Structural constraints are hard rejection criteria.** If the reviewer finds the dispatcher is over 150 lines after S02, or a dead V1 branch persists after S03, the task is rejected outright — regardless of whether tests pass.
