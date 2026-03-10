# R25 — Verify AgentTransport.close() Is Called on Shutdown

**Severity:** MEDIUM
**Audit ref:** M7
**Depends on:** None
**Blocks:** None

---

## Problem

`AgentTransport` interface defines a `close()` method (RFC Section 8). But the `AgentDispatcher.terminateAll()` method only closes V1 adapters. V2 transports stored in `AgentLifecycleStateV2.transport` are never closed during shutdown.

---

## 1. Exploration

- `src/core/agent-dispatcher.ts` — `terminateAll()` and `closeAll()`
- `src/interfaces/agent-transport.ts` — `close()` method
- `src/core/ductus-kernel.ts` — `shutdown()` sequence

---

## 2. Implementation

### 2.1 Close V2 transports on shutdown

In `terminateAll()` (or a new `closeV2Transports()` method), iterate over `lifecycleV2` map and call `transport.close()`:

```typescript
for (const [name, state] of this.lifecycleV2) {
  try {
    await state.transport.close()
  } catch (err) {
    console.warn(`Failed to close transport for agent ${name}:`, err)
  }
}
```

### 2.2 Close transport on agent replacement (R10)

When a V2 agent is replaced (lifecycle reset), close the old transport if it's a different instance. If transports are stateless (shared instances), don't close on replacement — only on final shutdown.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Test: verify `transport.close()` is called during kernel shutdown
- Run existing tests

---

## 4. Self-Review

- [ ] V2 transports are closed during shutdown
- [ ] Error handling prevents one transport failure from blocking others
- [ ] Transport is NOT closed on agent replacement (stateless per RFC)
- [ ] Close is idempotent (calling close twice is safe)
