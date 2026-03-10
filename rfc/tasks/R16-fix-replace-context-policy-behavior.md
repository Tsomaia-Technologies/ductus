# R16 — Fix ReplaceContextPolicy Behavior

**Severity:** MEDIUM
**Audit ref:** M6
**Depends on:** None
**Blocks:** None

---

## Problem

RFC Table in Section 5.4 describes `ReplaceContextPolicy` as: "Terminate adapter, create fresh with handoff context (current behavior)." The implementation just returns an empty conversation — it does not trigger adapter termination or handoff. This makes "replace" identical to "clear conversation."

---

## 1. Exploration

- `src/core/context-policies/replace-context-policy.ts` — current implementation
- `src/core/agent-dispatcher.ts` — `replaceAdapter()` (V1 handoff logic)
- RFC Section 5.4 — ReplaceContextPolicy description
- The V2 context policy call site in `enforceContextPolicy()`

---

## 2. Implementation

### Decision needed

In the V2 world, "replace" should mean:
1. Clear the conversation (current behavior)
2. Apply handoff context if configured (agent's handoff config for 'overflow' reason)

The V2 transport is stateless — there is no adapter to terminate. The conversation reset is sufficient for V2. But handoff context (a summary of what happened so far) should be injected as a system message amendment.

### Option A: Keep as-is, rename to ClearContextPolicy

If "replace" just means "start fresh," rename it to avoid confusion with the RFC description. Add a separate `ReplaceWithHandoffContextPolicy` later.

### Option B: Enrich with handoff context

Pass additional information to the policy (agent config, ledger access) so it can compose handoff context. This would require a richer interface.

### Recommendation

Option A — keep the simple behavior but add a JSDoc note that this clears the conversation. The full handoff logic is better handled at the dispatcher level (R10 handles replacement). Update the RFC table to reflect this.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Verify JSDoc/documentation is accurate
- Run existing tests

---

## 4. Self-Review

- [ ] `ReplaceContextPolicy` behavior is accurately documented
- [ ] RFC table description matches the actual implementation
- [ ] No functional regression
