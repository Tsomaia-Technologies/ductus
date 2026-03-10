# Task 13 — Migration, Deprecation, and Exports

**Phase:** 4 (Integration)
**Depends on:** Task 12 (pipeline and flow integration)
**Blocks:** Task 14
**Parallelizable with:** Partially with Task 12

---

## Objective

Finalize the public API surface:
1. Mark deprecated components (`AgentAdapter`, `AdapterEntity`, old-style flow registration)
2. Update `src/index.ts` exports to include all new public types
3. Ensure backward compatibility — existing code must still compile with deprecation warnings
4. Clean up any remaining type inconsistencies

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/index.ts` — the current public export surface
- `src/factories.ts` — the `Ductus.*` DSL entry point (updated in Task 12)
- `src/interfaces/entities/adapter-entity.ts` — `AgentAdapter` and `AdapterEntity` (to be deprecated)
- `src/interfaces/agent-lifecycle.ts` — `AgentTuple` references `AdapterEntity` (needs updating)
- `src/adapters/cli-agent-adapter.ts` — the CLI adapter (needs migration path to `AgentTransport`)

Identify all files that import deprecated types:
- Grep for `AgentAdapter` imports across the codebase
- Grep for `AdapterEntity` imports across the codebase
- Grep for `AgentTuple` usage (it references `AdapterEntity`)

---

## 2. Implementation

### 2.1 Deprecate `src/interfaces/entities/adapter-entity.ts`

Add JSDoc `@deprecated` annotations to both interfaces:

```typescript
/**
 * @deprecated Use `AgentTransport` from `../agent-transport.js` instead.
 * This interface will be removed in a future version.
 */
export interface AgentAdapter { ... }

/**
 * @deprecated Use `AgentTransport` directly. Transports do not need a factory wrapper.
 * This interface will be removed in a future version.
 */
export interface AdapterEntity { ... }
```

Do NOT delete the file or the interfaces. Existing code must still compile.

### 2.2 Update `src/interfaces/agent-lifecycle.ts`

Add `AgentTupleV2` alongside the existing `AgentTuple`:

```typescript
import { AgentTransport } from './agent-transport.js'
import { ModelEntity } from './entities/model-entity.js'
import { AgentEntity } from './entities/agent-entity.js'

export interface AgentTupleV2 {
  agent: AgentEntity
  model?: ModelEntity
  transport?: AgentTransport
}
```

Keep the existing `AgentTuple` with a `@deprecated` annotation.

### 2.3 Update `src/index.ts`

Add exports for all new public types. The new exports to add:

**Interfaces:**
- `AgentTransport`, `TransportRequest`, `ToolSchema` from `./interfaces/agent-transport.js`
- `Conversation`, `ConversationNode` from `./interfaces/conversation.js`
- `ContextPolicy`, `ContextPolicyName` from `./interfaces/context-policy.js`
- `ToolEntity`, `ToolContext` from `./interfaces/entities/tool-entity.js`
- `SkillAssertContext` from `./interfaces/entities/skill-entity.js`
- `ObservationConfig`, `ObservationEntry`, `SkillObservationEntry` from `./interfaces/observation-config.js`
- `AgentChunkToolResult` from `./interfaces/agent-chunk.js`

**Builders:**
- `ToolBuilder` from `./interfaces/builders/tool-builder.js`

**Implementations:**
- `Conversation` class from `./core/conversation.js` (the concrete class, not just the interface)
- Context policies from `./core/context-policies/index.js`

**Events:**
- `observationEvents` (and individual events) from `./events/observation-events.js`

**Do NOT export internal implementation details:**
- `invokeAgent` from `src/core/agent-invocation.ts` — internal
- `parseAgentOutput` from `src/core/output-parser.ts` — internal

### 2.4 Verify CLI Adapter Status

Read `src/adapters/cli-agent-adapter.ts` and document its current status:
- Does it implement `AgentAdapter`?
- Can it be adapted to implement `AgentTransport` instead?
- Create a migration note (not an implementation) describing how CLI adapter would be converted

Do NOT rewrite the CLI adapter in this task. That is future work.

### 2.5 Update `src/interfaces/builders/cli-adapter-builder.ts` and `src/builders/immutable-cli-adapter-builder.ts`

Add `@deprecated` JSDoc annotations to both files. The CLI adapter builder produces an `AdapterEntity`, which is deprecated.

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Verify all exports in `src/index.ts` resolve correctly.
- Verify deprecated types still compile (no removal, just annotations).
- Run all sample2 tests to confirm backward compatibility.
- Run `npx jest` to confirm all existing tests pass.
- Verify no new exports leak internal implementation details.

---

## 4. Report

After completing the task, provide:
- List of files modified
- Complete list of new public exports added to `src/index.ts`
- List of deprecated types/interfaces
- Confirmation that `npx tsc --noEmit` passes
- Test results (sample2 + jest)
- Migration note for CLI adapter

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] All new interfaces from Tasks 00-02 are exported from `src/index.ts`
- [ ] All new builders from Tasks 06-08 are exported
- [ ] Observation events are exported (both individually and as `observationEvents` object)
- [ ] `Conversation` concrete class is exported (users need to call `Conversation.create()`)
- [ ] Context policy implementations are exported (users may need to instantiate them directly)
- [ ] `AgentAdapter` and `AdapterEntity` have `@deprecated` JSDoc
- [ ] `AgentTuple` has `@deprecated` JSDoc, `AgentTupleV2` exists alongside it
- [ ] CLI adapter builder has `@deprecated` JSDoc
- [ ] Internal implementations (`invokeAgent`, `parseAgentOutput`) are NOT exported
- [ ] All tests pass
- [ ] No circular import chains in the new exports

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. **Export surface:** is the set of new public exports correct? Too many? Too few?
2. **Deprecation strategy:** are `@deprecated` JSDoc annotations sufficient, or should we add runtime warnings (`console.warn` on first use)?
3. **`AgentTupleV2` naming:** should this be `AgentRegistration` or something more descriptive?
4. **CLI adapter migration path:** is the documented migration path feasible?
5. **Versioning concern:** should this be a major version bump given the deprecated interfaces?
