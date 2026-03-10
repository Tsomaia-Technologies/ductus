# R21 — Resolve duration vs durationMs Naming

**Severity:** LOW
**Audit ref:** L2
**Depends on:** R07 (if addressed together)
**Blocks:** None

---

## Problem

RFC payload tables use `duration`. Implementation uses `durationMs`. `durationMs` is more explicit about units. The naming should be consistent across the codebase and RFC.

---

## 1. Exploration

- `src/events/observation-events.ts` — all events with duration fields
- RFC Section 11.1 — payload tables

---

## 2. Implementation

### Decision: Keep `durationMs`, update RFC

`durationMs` is unambiguous. Update all RFC references from `duration` to `durationMs`.

Events affected:
- `AgentCompleted`
- `SkillCompleted`
- `ToolCompleted`

---

## 3. Checks

- RFC updated
- No code changes needed

---

## 4. Self-Review

- [ ] All RFC duration references use `durationMs`
- [ ] All implementation duration fields use `durationMs`
- [ ] Consistent across all events
