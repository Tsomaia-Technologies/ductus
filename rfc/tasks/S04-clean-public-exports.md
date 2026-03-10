# S04 — Clean Up Public Exports

**Phase:** 3 (Integration)
**Depends on:** S00, S01, S02, S03
**Blocks:** S05

---

## Why This Task Exists

`src/index.ts` is the public API surface of Ductus. It's what users import when they write `import { ... } from 'ductus'`. Right now, it re-exports everything — including files that were deleted in S00 and types that no longer make sense after the architectural changes.

A framework's export surface is its contract with users. Exporting deleted types causes compile errors. Exporting internal implementation details (like `invokeAgent`, `parseAgentOutput`, `AgentDispatcher` internals) creates coupling to things users should never touch. Exporting both old and new names for the same concept creates confusion.

This task makes `src/index.ts` reflect the actual architecture: only the new agentic types, the builders, the factories, and the core runtime.

---

## 1. Exploration

Read `src/index.ts` fully. For every `export * from` line, determine:
- **Still valid?** Does the file exist and contain types users need?
- **Internal?** Does it expose implementation details users should not depend on?
- **Dead?** Does it point to a deleted file (from S00)?

Categories after S00-S03:

**Must remove (file deleted in S00):**
- `./adapters/cli-agent-adapter.js`
- `./builders/immutable-cli-adapter-builder.js`
- `./interfaces/builders/adapter-builder.js`
- `./interfaces/builders/cli-adapter-builder.js`
- `./interfaces/entities/adapter-entity.js`
- `./interfaces/agent-context.js`

**Should NOT be public exports (internal implementation):**
- `./core/agent-dispatcher.js` — the dispatcher is an internal coordinator, not a user-facing type. Users interact via `Ductus.kernel()`, not by importing `AgentDispatcher` directly. However, `TemplateRenderer` is exported from this file and IS user-facing. If `TemplateRenderer` is the only public symbol, it should be moved to its own interface file.
- `./core/linked-list.js` — internal data structure for `Conversation`
- `./core/intent-processor.js` — internal kernel plumbing
- `./core/intents.js` — internal kernel plumbing

**Should be public exports (new agentic types added by RFC 0001):**
- Verify these ARE exported:
  - `./interfaces/agent-transport.js` — `AgentTransport`, `TransportRequest`, `ToolSchema`
  - `./interfaces/conversation.js` — `Conversation` interface
  - `./interfaces/context-policy.js` — `ContextPolicy`, `ContextPolicyName`
  - `./interfaces/entities/tool-entity.js` — `ToolEntity`, `ToolContext`
  - `./interfaces/entities/skill-entity.js` — `SkillAssertContext`
  - `./interfaces/observation-config.js` — `ObservationConfig`
  - `./interfaces/agent-chunk.js` — `AgentChunk` types
  - `./core/conversation.js` — `ConversationImpl` (concrete class users call `.create()` on)
  - `./core/context-policies/index.js` — all 4 policy implementations
  - `./events/observation-events.js` — observation event definitions
  - `./interfaces/builders/tool-builder.js` — `ToolBuilder`

---

## 2. Implementation

### 2.1 Remove dead exports from `src/index.ts`

Delete every `export * from` line pointing to a file deleted in S00.

### 2.2 Move `TemplateRenderer` to its own interface file

If `TemplateRenderer` is the only public symbol from `agent-dispatcher.ts`, create `src/interfaces/template-renderer.ts`:

```typescript
export type TemplateRenderer = (template: string, context: Record<string, any>) => string | Promise<string>
```

Update `agent-dispatcher.ts` to import from this new file instead of defining it inline. Update `index.ts` to export from the new location.

### 2.3 Evaluate internal exports

For each potentially-internal export, decide:
- If nothing outside the framework imports it, remove it from `index.ts`
- If it's needed by advanced users (e.g., `Mutex`, `EventChannel`), keep it but document why

**Minimum removals:**
- `./core/linked-list.js` — definitely internal (Conversation's implementation detail)

**Keep but note:**
- `./core/mutex.js` — users might need `Mutex` for custom processors
- `./core/event-channel.js` — users might need for custom coordination

### 2.4 Verify all new RFC types are exported

Cross-check against the RFC. Every user-facing type introduced by RFC 0001 must be importable from `'ductus'`.

### 2.5 Clean `factories.ts` default export

Verify the `Ductus.*` namespace object no longer includes `adapter`. After S00, this should already be gone, but verify.

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- `npx jest` — must pass
- No export line in `index.ts` points to a non-existent file
- Every type listed in RFC Section 16.2 (Non-Breaking Changes) is importable

---

## 4. Anti-Goals (reviewer MUST reject if any are true)

- `index.ts` exports a deleted file
- `index.ts` exports `adapter-entity.ts` or `adapter-builder.ts`
- `TemplateRenderer` is only available by importing `agent-dispatcher.ts`
- A user-facing type from RFC 0001 is NOT exported

---

## 5. Report

- Exports removed (list every one)
- Exports added (list every one)
- Files created (if `TemplateRenderer` was moved)
- Test results

---

## 6. Self-Review

- [ ] No dead exports in `index.ts`
- [ ] `TemplateRenderer` has its own interface file
- [ ] All RFC 0001 types are importable from the package
- [ ] Internal implementation details are not publicly exported
- [ ] All tests pass
