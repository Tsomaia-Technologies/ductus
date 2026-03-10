# S00 — Delete the V1 Adapter Path

**Phase:** 1 (Demolition)
**Depends on:** Nothing — this is the first task
**Blocks:** S01, S02, S03

---

## Why This Task Exists

The RFC (Section 1.4) identified that `AgentAdapter` conflates four concerns: session management, transport, output parsing, and lifecycle. The RFC's solution was to replace it with `AgentTransport` (a thin pipe) and move everything else into the framework.

The new components exist and work: `AgentTransport`, `invokeAgent()`, `Conversation`, context policies, observation events. But the old adapter path was never removed. The dispatcher still has the entire V1 code path — `invoke()`, `invokeContext()`, `invokeAndParse()`, `getOrCreateLifecycleState()`, `enforceLifecycleLimits()`, `replaceAdapter()`, and the interceptor pipeline — running alongside V2. This makes the dispatcher 703 lines with 10+ concerns instead of the clean coordinator the RFC envisioned.

This task deletes the old path. No deprecation. No backward compatibility. This is an unreleased framework.

---

## 1. Exploration

Read and catalog everything that must die:

- `src/interfaces/entities/adapter-entity.ts` — `AgentAdapter`, `AdapterEntity`
- `src/interfaces/builders/adapter-builder.ts` — adapter builder interface
- `src/interfaces/builders/cli-adapter-builder.ts` — CLI adapter builder interface
- `src/builders/immutable-cli-adapter-builder.ts` — CLI adapter builder implementation
- `src/adapters/cli-agent-adapter.ts` — CLI adapter implementation
- `src/core/pipeline/agent-interceptor.ts` — `AgentInterceptor`, `InvocationContext`
- `src/core/pipeline/interceptors/template-interceptor.ts` — `TemplateInterceptor`
- `src/interfaces/agent-context.ts` — `AgentContext` (old message bag for adapters)
- `src/interfaces/agent-lifecycle.ts` — `AgentTuple` (deprecated), `AgentLifecycleState` (deprecated)

In `src/core/agent-dispatcher.ts`, identify every V1 method:
- `invoke()` — V1 streaming path
- `invokeContext()` — V1 interceptor pipeline
- `invokeAndParse()` — V1 collect-and-parse
- `getOrCreateLifecycleState()` — V1 lifecycle (adapter-based)
- `enforceLifecycleLimits()` — V1 limits (calls replaceAdapter)
- `replaceAdapter()` — V1 adapter replacement with handoff rendering
- `lifecycle` map — V1 state storage

In `src/factories.ts`, identify V1 references:
- `ImmutableCliAdapterBuilder` import and `adapter()` factory
- `CliAdapterBuilder` import
- The `adapter` entry in the default export

In `src/index.ts`, identify V1 exports.

Grep for ALL imports of deleted files/types across the entire `src/` directory. Every import site must be updated or the file must be deleted.

---

## 2. Implementation

### 2.1 Delete these files entirely

- `src/interfaces/entities/adapter-entity.ts`
- `src/interfaces/builders/adapter-builder.ts`
- `src/interfaces/builders/cli-adapter-builder.ts`
- `src/builders/immutable-cli-adapter-builder.ts`
- `src/adapters/cli-agent-adapter.ts`
- `src/core/pipeline/agent-interceptor.ts`
- `src/core/pipeline/interceptors/template-interceptor.ts`
- `src/interfaces/agent-context.ts`

### 2.2 Delete V1 methods from `src/core/agent-dispatcher.ts`

Remove these methods entirely:
- `invoke()`
- `invokeContext()`
- `invokeAndParse()`
- `getOrCreateLifecycleState()` (the V1 version — NOT `getOrCreateLifecycleStateV2`)
- `enforceLifecycleLimits()` (the V1 version — NOT `enforceLifecycleLimitsV2`)
- `replaceAdapter()`

Remove the `lifecycle` map (V1 state). Keep `lifecycleV2`.

Remove imports of deleted types: `AgentInterceptor`, `InvocationContext`, `TemplateInterceptor`, `FileAdapter` (if only used by interceptors), `AgentContext`.

### 2.3 Remove V1 from `src/factories.ts`

- Remove `ImmutableCliAdapterBuilder` import
- Remove `CliAdapterBuilder` import
- Remove `adapter()` factory function
- Remove `adapter` from the default export object

### 2.4 Remove V1 from `src/index.ts`

Remove exports of all deleted files and types.

### 2.5 Fix all broken imports

After deleting, `npx tsc --noEmit` will show every file that imports something deleted. Fix each one:
- If the file only existed to support V1 (e.g., test files for adapters), delete it too
- If the file uses both V1 and V2, remove the V1 import and code paths

### 2.6 Delete `src/__tests__/agent-dispatcher.baseline.test.ts`

This test file tests the V1 dispatcher path and has been failing since before the RFC work. It mocks `AgentAdapter` and tests `invokeAndParse()` through the V1 interceptor pipeline. Delete it — the V2 path has its own test coverage in `agentic-integration.test.ts` and `v2-reaction-e2e.test.ts`.

---

## 3. Checks

- `npx tsc --noEmit` — must pass (excluding pre-existing errors in `sample2/` and external refs)
- `npx jest` — must pass (with equal or fewer failures than before)
- `grep -r "AgentAdapter" src/` — must return 0 results
- `grep -r "AdapterEntity" src/` — must return 0 results  
- `grep -r "InvocationContext" src/` — must return 0 results
- `grep -r "AgentInterceptor" src/` — must return 0 results
- `grep -r "@deprecated" src/` — must return 0 results

---

## 4. Anti-Goals (reviewer MUST reject if any are true)

- Any `@deprecated` annotation still exists in `src/`
- Any V1-only file still exists
- Any V1 method still exists on `AgentDispatcher`
- The `lifecycle` (V1) map still exists on `AgentDispatcher`
- `AgentAdapter` or `AdapterEntity` is referenced anywhere in `src/`
- The `adapter()` factory is still exported from `factories.ts`

---

## 5. Structural Constraints

- After this task, `agent-dispatcher.ts` must have FEWER lines than before
- After this task, the `src/core/pipeline/` directory should be empty or deleted
- After this task, `src/adapters/` directory should be empty or deleted

---

## 6. Report

- Files deleted (list every one)
- Methods removed from `AgentDispatcher`
- Lines before vs. lines after for `agent-dispatcher.ts`
- Grep results confirming zero V1 references
- Test results

---

## 7. Self-Review

- [ ] No file in `src/` imports anything from deleted files
- [ ] `AgentDispatcher` has no V1 methods
- [ ] `factories.ts` has no adapter-related code
- [ ] `index.ts` has no adapter-related exports
- [ ] All remaining tests pass
- [ ] The dispatcher is SHORTER than before this task
