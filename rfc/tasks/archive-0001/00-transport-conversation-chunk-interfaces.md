# Task 00 — Transport, Conversation, and Chunk Interfaces

**Phase:** 0 (Interface Lock)
**Depends on:** Nothing
**Blocks:** Tasks 03, 09, 10, 11

---

## Objective

Define the interfaces for the new transport layer, the immutable conversation data structure, and the updated chunk vocabulary. These replace the current `AgentAdapter` interface as the framework's communication contract with LLM backends.

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/interfaces/entities/adapter-entity.ts` — the current adapter interface being replaced
- `src/interfaces/agent-chunk.ts` — the current chunk union being extended
- `src/interfaces/agentic-message.ts` — the message types that `Conversation` will hold
- `src/interfaces/agent-tool-call.ts` — the `AgentToolCall` type referenced by chunks
- `src/interfaces/entities/model-entity.ts` — the `ModelEntity` shape (used in `TransportRequest`)
- `src/interfaces/schema.ts` — the `Schema` type

Confirm you understand:
- The `AgenticMessage` discriminated union (`SystemMessage | UserMessage | AssistantMessage | ToolMessage`)
- The `AgentChunk` discriminated union and `AgentChunkBase` pattern
- The `AgentToolCall` shape (`{ id, name, arguments }`)
- The `ModelEntity` shape (`{ model: string, temperature: number | null }`)

---

## 2. Implementation

### 2.1 Create `src/interfaces/agent-transport.ts`

Write this file with the exact interfaces below. Do not deviate from these definitions.

```typescript
import { Conversation } from './conversation.js'
import { AgentChunk } from './agent-chunk.js'

export interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface TransportRequest {
  conversation: Conversation
  newFromIndex: number
  tools?: ToolSchema[]
  model: string
  temperature?: number
  outputFormat?: 'text' | 'json'
}

export interface AgentTransport {
  send(request: TransportRequest): AsyncIterable<AgentChunk>
  close(): Promise<void>
}
```

### 2.2 Create `src/interfaces/conversation.ts`

Write this file with the exact interface below. This defines only the public shape. The implementation class (Task 03) will implement this interface.

```typescript
import { AgenticMessage } from './agentic-message.js'

export interface ConversationNode {
  readonly message: AgenticMessage
  readonly prev: ConversationNode | null
}

export interface Conversation {
  readonly systemMessage: string
  readonly messages: readonly AgenticMessage[]
  readonly tokenEstimate: number
  readonly length: number

  append(message: AgenticMessage): Conversation
}
```

### 2.3 Modify `src/interfaces/agent-chunk.ts`

Add the `AgentChunkToolResult` interface and include it in the `AgentChunk` union. The existing chunk types must remain unchanged. The exact addition:

```typescript
export interface AgentChunkToolResult extends AgentChunkBase {
  type: 'tool-result'
  toolCallId: string
  result: unknown
}
```

The updated `AgentChunk` union becomes:

```typescript
export type AgentChunk =
  | AgentChunkReasoning
  | AgentChunkText
  | AgentChunkToolCall
  | AgentChunkToolResult
  | AgentChunkError
  | AgentChunkUsage
  | AgentChunkData
  | AgentChunkComplete
```

---

## 3. Checks

- Run `npx tsc --noEmit` from the project root. The new files must compile without errors.
- Verify no existing files are broken by the additions. The new files are additive — no existing imports should change.
- Verify `AgentChunkToolResult` is exported from the file alongside the other chunk types.
- Verify all imports resolve correctly (paths use `.js` extension per ESM convention).

---

## 4. Report

After completing the task, provide:
- List of files created and modified
- Confirmation that `npx tsc --noEmit` passes
- Any concerns about the interface definitions (naming, types, missing fields)

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] `AgentTransport.send()` returns `AsyncIterable<AgentChunk>`, not `AsyncGenerator`
- [ ] `TransportRequest.conversation` is typed as `Conversation` (the interface), not a concrete class
- [ ] `Conversation.messages` returns `readonly AgenticMessage[]` (frozen/immutable)
- [ ] `Conversation.append()` returns a new `Conversation`, not `void`
- [ ] `AgentChunkToolResult.result` is typed as `unknown`, not `any`
- [ ] All new exports use named exports (no default exports)
- [ ] No circular imports introduced

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review from the reviewer. Highlight:
1. The `Conversation` interface — is this the right public contract for immutability?
2. The `TransportRequest` shape — does `newFromIndex` + `conversation` fully cover both stateless (API) and stateful (CLI) transports?
3. The `ToolSchema` — is `parameters: Record<string, unknown>` sufficient for JSON Schema representation, or should it be more specific?
