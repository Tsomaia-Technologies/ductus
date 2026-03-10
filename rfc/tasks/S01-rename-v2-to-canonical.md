# S01 — Rename V2 to Canonical Names

**Phase:** 1 (Demolition)
**Depends on:** S00
**Blocks:** S02

---

## Why This Task Exists

After S00 deletes the V1 path, the remaining code is littered with "V2" suffixes — `AgentLifecycleStateV2`, `AgentTupleV2`, `lifecycleV2`, `invokeAndParseV2`, `getOrCreateLifecycleStateV2`, `enforceLifecycleLimitsV2`, `hasV2Transport`. These names only made sense when V1 and V2 coexisted. With V1 gone, "V2" is noise. The names should be what they always should have been.

This is a naming task, not a logic task. No behavior changes. Pure rename.

---

## 1. Exploration

Find every V2-suffixed symbol:

In `src/interfaces/agent-lifecycle.ts`:
- `AgentTupleV2` → rename to `AgentTuple`
- `AgentLifecycleStateV2` → rename to `AgentLifecycleState`

In `src/core/agent-dispatcher.ts`:
- `lifecycleV2` map → rename to `lifecycle`
- `invokeAndParseV2()` → rename to `invokeAndParse()`
- `getOrCreateLifecycleStateV2()` → rename to `getOrCreateLifecycleState()`
- `enforceLifecycleLimitsV2()` → rename to `enforceLifecycleLimits()`
- `hasV2Transport()` → rename to `hasTransport()`

Find every file that imports or references any of these symbols and update them.

---

## 2. Implementation

### 2.1 Rename interfaces in `src/interfaces/agent-lifecycle.ts`

- Delete the old `AgentTuple` (V1 — should already be gone from S00) and `AgentLifecycleState` (V1)
- Rename `AgentTupleV2` → `AgentTuple`
- Rename `AgentLifecycleStateV2` → `AgentLifecycleState`
- Remove any `@deprecated` annotations — there's nothing deprecated anymore

### 2.2 Rename methods in `src/core/agent-dispatcher.ts`

Use your editor's rename/replace:
- `lifecycleV2` → `lifecycle`
- `invokeAndParseV2` → `invokeAndParse`
- `getOrCreateLifecycleStateV2` → `getOrCreateLifecycleState`
- `enforceLifecycleLimitsV2` → `enforceLifecycleLimits`
- `hasV2Transport` → `hasTransport`

### 2.3 Update all callers

Grep for every V2-suffixed symbol across the codebase and update:
- `src/utils/internals.ts` — calls `dispatcher.hasV2Transport()` and `dispatcher.invokeAndParseV2()`
- `src/__tests__/*.ts` — tests reference V2 methods and types
- `src/factories.ts` — may reference `AgentTuple`
- Any other file

### 2.4 Update `src/index.ts`

Ensure the renamed types are exported with their new names.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- `npx jest` — must pass
- `grep -r "V2" src/ --include="*.ts"` — must return 0 results (except in comments explaining migration or test names that reference the concept)
- `grep -r "v2" src/ --include="*.ts" -i` — same check, case insensitive

---

## 4. Anti-Goals (reviewer MUST reject if any are true)

- Any symbol with "V2" suffix remains in production code
- Any `@deprecated` annotation remains
- Any behavioral change was introduced (this is rename-only)

---

## 5. Report

- Every symbol renamed (old → new)
- Every file updated
- Grep results confirming zero V2 references
- Test results
