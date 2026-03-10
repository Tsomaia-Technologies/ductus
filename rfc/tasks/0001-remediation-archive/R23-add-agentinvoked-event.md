# R23 — Add AgentInvoked Event Emission Logic

**Severity:** HIGH
**Audit ref:** H7 (part of observation gap)
**Depends on:** R01
**Blocks:** None

---

## Problem

`AgentInvoked` is defined as one of the 11 observation events but its emission point is unclear. Per RFC Section 10, it should be emitted at the very start of the invocation sequence — before any skill processing. This task ensures the emission point is planned in R01 and that the event is emitted from the correct location.

---

## 1. Exploration

- `src/events/observation-events.ts` — `AgentInvoked` definition
- `src/core/agent-invocation.ts` — start of `invokeAgent`
- `src/core/agent-dispatcher.ts` — `invokeAndParseV2` (where `invokeAgent` is called)

The event should be emitted immediately when `invokeAndParseV2` is called (before entering the tool/retry loops).

---

## 2. Implementation

This task is primarily about verifying the correct emission point. If R01 is implemented first, verify:

1. `AgentInvoked` is emitted at the start of `invokeAgent`, before the skill loop
2. The payload includes `{ agent: agentName }` (per the event definition)
3. The observation config check happens correctly

If R01 is NOT yet implemented, ensure the emission point is specified in R01's instructions.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Test: invoke agent, verify `AgentInvoked` is emitted first (before `SkillInvoked`)
- Run existing tests

---

## 4. Self-Review

- [ ] `AgentInvoked` emitted exactly once per `invokeAgent` call
- [ ] Emitted before any skill processing
- [ ] Payload matches event definition
- [ ] Observation config is respected
