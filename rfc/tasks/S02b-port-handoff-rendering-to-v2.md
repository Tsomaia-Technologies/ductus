# S02b — Port Handoff Rendering to the V2 Lifecycle Path

**Phase:** 2 (Architecture)
**Depends on:** S02
**Blocks:** S03

---

## Why This Task Exists

S00 deletes `replaceAdapter()` — the V1 method that implemented handoff rendering. Handoff rendering is the feature where, when an agent hits a lifecycle limit (overflow, failure, scope), the framework:

1. Reads events from the ledger
2. Computes head/tail event windows (with failed event injection for failure handoffs)
3. Optionally asks the agent for a conversation summary (for scope handoffs)
4. Renders a handoff template with event context, state, and failure/hallucination counts
5. Initializes the new agent session with the rendered handoff as part of the system message

This is a user-facing feature. The agent builder accepts `.handoff()` (RFC 5.1, lines 351-354). The entity stores handoff config (`HandoffReason`, template path, `headEvents`, `tailEvents`, `agentSummary`). After S00, **nothing reads this config.** The V2 `enforceLifecycleLimits()` just creates a fresh conversation with a bare system message — zero handoff context.

Without this task, handoff config becomes dead configuration. Users would configure `.handoff({ reason: 'overflow', template: '...' })` and the framework would silently ignore it.

---

## 1. Exploration

Before S00 deletes it, study the V1 handoff rendering in `src/core/agent-dispatcher.ts` lines 378-513 (`replaceAdapter()`). Understand:

1. **Event windowing** — `readAllEvents()` + head/tail slicing + failed event injection
2. **Agent summary** — optional LLM-based conversation summary for scope handoffs (lines 437-453)
3. **Template rendering** — handoff template loaded from file, rendered with `templateRenderer`
4. **Template context** — what data the template receives: `reason`, `state`, `headEvents`, `tailEvents`, `failureCount`, `hallucinationCount`, `agent.name`, `agent.role`, `agentSummary`

Also read:
- `src/interfaces/entities/agent-entity.ts` — `HandoffReason`, handoff config shape
- `src/interfaces/agent-lifecycle.ts` — `TurnRecord` (used for failed sequence detection)

Key differences from V1 to V2:
- V1 called `adapter.terminate()` → V2 must call `transport.close()` (or keep transport, just reset conversation)
- V1 called `adapter.create()` + `adapter.initialize()` → V2 just creates a new `Conversation`
- V1 agent summary used `adapter.process()` to ask the old adapter → V2 would need to use the transport via `invokeAgent()` or a direct `transport.send()` call

---

## 2. Implementation

### 2.1 Create `src/core/agent-handoff.ts`

**What it owns:** Computing handoff context (event windows, templates) and producing a handoff-enriched system message. This is a pure function module — given inputs, it produces a string. No mutable state.

```typescript
import { AgentEntity, HandoffReason } from '../interfaces/entities/agent-entity.js'
import { CommittedEvent } from '../interfaces/event.js'
import { TurnRecord } from '../interfaces/agent-lifecycle.js'
import { TemplateRenderer } from '../interfaces/template-renderer.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'

export interface HandoffContext {
  reason: HandoffReason
  state: unknown
  headEvents: AnnotatedEvent[]
  tailEvents: AnnotatedEvent[]
  failureCount: number
  hallucinationCount: number
  agent: { name: string; role?: string }
  agentSummary?: string
}

export interface AnnotatedEvent {
  type: string
  payload: unknown
  sequence: number
  timestamp: number
  isFailed: boolean
}

export async function renderHandoff(params: {
  agent: AgentEntity
  reason: HandoffReason
  state: unknown
  events: CommittedEvent[]
  turnRecords: TurnRecord[]
  failureCount: number
  hallucinationCount: number
  templateRenderer: TemplateRenderer
  fileAdapter: FileAdapter
  systemAdapter: SystemAdapter
  agentSummary?: string
}): Promise<string | undefined> {
  // 1. Find the handoff config for this reason
  // 2. If no handoff config, return undefined
  // 3. Annotate events with isFailed (from turnRecords)
  // 4. Compute head/tail windows
  // 5. For failure handoffs, inject failed events into tail
  // 6. Load and render the handoff template
  // 7. Return rendered handoff content
}

export function getFailedSequences(turnRecords: TurnRecord[]): Set<number> {
  // Extract from current dispatcher's private helper
}
```

### 2.2 Integrate handoff into `AgentLifecycleManager`

In the lifecycle manager (created in S02), when `enforceLimits()` detects a reset is needed:

1. Determine the `HandoffReason` (overflow, failure, scope)
2. Call `renderHandoff()` with the current lifecycle state, events from the ledger, and the agent config
3. If handoff content is returned, compose the new system message as `systemMessage + '\n\n' + handoffContent`
4. Create the new conversation with the enriched system message

The lifecycle manager needs access to the ledger (for `readAllEvents`). This is a new dependency — it was previously on the dispatcher. Pass it through the constructor.

### 2.3 Handle agent summary for scope handoffs

The V1 implementation asked the old adapter to summarize the conversation. In V2, the equivalent is:
- Use the current transport to send a summary request before resetting
- Or, use a simpler approach: pass the last N messages as context in the handoff template (no LLM call)

If the handoff config has `agentSummary: true` and the reason is `'scope'`:
1. Build a summary request using the current conversation + a summary prompt
2. Call `transport.send()` with the summary request
3. Collect the text response
4. Pass it as `agentSummary` to `renderHandoff()`

If this is too complex for this task, document the limitation and defer the LLM-based summary. The event-based handoff (head/tail windows, template rendering) is the priority.

### 2.4 Write tests — `src/__tests__/agent-handoff.test.ts`

Test cases:
1. **No handoff config** — `renderHandoff()` returns undefined
2. **Overflow handoff** — renders template with head/tail events
3. **Failure handoff** — injects failed events into tail window
4. **Head+tail windowing** — when events > head+tail, correctly slices; when events <= head+tail, returns all
5. **Failed sequence detection** — `getFailedSequences()` correctly maps turn records to sequences

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- `npx jest` — must pass
- Verify that an agent with `.handoff()` config actually gets handoff context in its reset conversation
- Verify that an agent WITHOUT `.handoff()` config gets a bare system message on reset (no regression)

---

## 4. Anti-Goals (reviewer MUST reject if any are true)

- Handoff rendering is still inside `AgentDispatcher` or `AgentLifecycleManager` as a 100+ line inline method → REJECT (it must be in `agent-handoff.ts`)
- `AgentEntity.handoffs` is referenced nowhere in the V2 path → REJECT
- Event windowing (head/tail) is not implemented → REJECT
- Failed event injection for failure handoffs is not implemented → REJECT
- No tests for handoff rendering → REJECT

---

## 5. Report

- Files created
- How handoff integrates with the lifecycle manager
- Whether LLM-based agent summary was implemented or deferred (with justification)
- Test results

---

## 6. Self-Review

- [ ] `src/core/agent-handoff.ts` exists with `renderHandoff()` and `getFailedSequences()`
- [ ] `AgentLifecycleManager.enforceLimits()` calls `renderHandoff()` when resetting
- [ ] Handoff content is included in the reset conversation's system message
- [ ] Head/tail event windowing works correctly
- [ ] Failed event injection works for failure handoffs
- [ ] Agents without handoff config still reset cleanly
- [ ] Tests cover all handoff scenarios
- [ ] No handoff logic remains inline in the dispatcher
