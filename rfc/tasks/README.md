# RFC 0001 — Remediation Tasks

Post-implementation audit remediation. Tasks numbered `R00–R28`.

## Severity Legend

| Severity | Meaning |
|----------|---------|
| CRITICAL | Feature is structurally broken or not wired up at all |
| HIGH | Feature exists but deviates from RFC in a way that affects correctness |
| MEDIUM | Inconsistency, missing option, or documentation gap |
| LOW | Naming, typing, or stylistic deviation |

## Task List

### Critical (must fix — system does not work without these)

| Task | Title | Audit Ref |
|------|-------|-----------|
| R00 | Wire reaction pipeline to V2 invocation path | C1 |
| R01 | Emit observation events from invokeAgent | C2 |
| R02 | Route observation events through multiplexer | C3 |

### High (correctness issues)

| Task | Title | Audit Ref |
|------|-------|-----------|
| R03 | Fix tool schema generation (empty parameters) | H1 |
| R04 | Support parallel tool calls | H2 |
| R07 | Fix observation event payloads to match RFC | H7-H9, L1-L3 |
| R08 | Fix V2 dispatcher transport resolution (flow override) | H10 |
| R09 | Fix V2 dispatcher model resolution | H11 |
| R10 | Enforce V2 lifecycle limits (maxFailures, scope) | H12 |
| R11 | Wire hallucination tracking | H13 |
| R23 | Add AgentInvoked event emission logic | H7 (part) |
| R24 | Add volatile event support to sequencer/multiplexer | C2/R02 dep |
| R27 | Add end-to-end V2 reaction test | C1-C3 verify |

### Medium (inconsistency / gaps)

| Task | Title | Audit Ref |
|------|-------|-----------|
| R05 | Remove undocumented outputFormat from TransportRequest | H3 |
| R06 | Optimize Conversation messages getter | H4, M4 |
| R12 | Fix SummarizeContextPolicy model resolution | M1 |
| R13 | Add preserveSystem to SummarizeContextPolicy | M2 |
| R15 | Fix SlidingWindowContextPolicy ignoring limit param | M5 |
| R16 | Fix ReplaceContextPolicy behavior documentation | M6 |
| R17 | Document ToolContext.use and SkillAssertContext.use deviation | H5, H6 |
| R25 | Verify AgentTransport.close() called on shutdown | M7 |
| R26 | Fix Schema = ZodSchema leak (document) | M8 |
| R28 | Update RFC with implementation deviations | All deviations |

### Low (naming / typing / style)

| Task | Title | Audit Ref |
|------|-------|-----------|
| R14 | Fix AgentChunkData.data typing (any → unknown) | M3 |
| R18 | Fix ephemeral() return type (void → this) | L6 |
| R19 | Clean up agent-lifecycle.ts deprecated imports | L5 |
| R20 | Resolve AgentStreamChunk payload shape | L1 |
| R21 | Resolve duration vs durationMs naming | L2 |
| R22 | Add total to AgentCompleted.tokenUsage | L3 |

## Dependency Graph (simplified)

```
R24 (volatile events) ─┐
                        ├──► R02 (route obs through multiplexer)
R00 (wire pipeline) ────┤
                        ├──► R01 (emit obs events)
                        │         ├──► R23 (AgentInvoked)
                        │         └──► R11 (hallucination)
                        └──► R27 (e2e test)

R08 (transport resolution) ──► R09 (model resolution)
                              └──► R10 (lifecycle limits)

R07 (event payloads) ──► R28 (RFC update, done last)
R17, R20, R21, R22 ────►
```

## Recommended Execution Order

1. **Phase 1 — Foundation:** R24, R05, R14, R18, R19
2. **Phase 2 — Core Wiring:** R00, R03, R04, R06
3. **Phase 3 — Observation:** R01, R07, R23
4. **Phase 4 — Routing & Lifecycle:** R02, R08, R09, R10, R11
5. **Phase 5 — Context Policies:** R12, R13, R15, R16
6. **Phase 6 — Cleanup & Docs:** R17, R20, R21, R22, R25, R26
7. **Phase 7 — Verification:** R27, R28
