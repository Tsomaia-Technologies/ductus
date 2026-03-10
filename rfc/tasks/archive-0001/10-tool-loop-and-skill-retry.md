# Task 10 — Framework Tool Loop and Skill Retry Loop

**Phase:** 3 (Core Runtime)
**Depends on:** Task 00 (AgentTransport, Conversation, AgentChunk with tool-result), Task 01 (ToolEntity), Task 02 (SkillEntity with assert/maxRetries), Task 03 (Conversation class), Task 09 (output parser)
**Blocks:** Task 11
**Sequential:** Must be completed before Task 11

---

## Objective

Implement the core agent invocation engine — the component that replaces `AgentDispatcher.invokeAndParse()` with a framework-owned invocation that includes:
1. The tool execution loop (agent requests tool → framework executes → feeds result back)
2. The skill assertion + retry loop (output fails assertion → retry with feedback)
3. Framework-owned output parsing (using Task 09's parser)

This is the single most complex task in the RFC implementation.

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/core/agent-dispatcher.ts` — the current `invokeAndParse()` and `invokeContext()` methods (the code being replaced)
- `src/utils/internals.ts` — `executePipeline()` and `createReactionAdapter()` (the current call site)
- `src/interfaces/agent-transport.ts` — `AgentTransport`, `TransportRequest`, `ToolSchema` (Task 00)
- `src/interfaces/conversation.ts` — `Conversation` interface (Task 00)
- `src/core/conversation.ts` — `Conversation` class (Task 03)
- `src/interfaces/entities/tool-entity.ts` — `ToolEntity`, `ToolContext` (Task 01)
- `src/interfaces/entities/skill-entity.ts` — `SkillEntity` with `assert`, `maxRetries` (Task 02)
- `src/interfaces/agent-chunk.ts` — all chunk types including `AgentChunkToolCall`, `AgentChunkToolResult`
- `src/core/output-parser.ts` — `parseAgentOutput()` (Task 09)
- `src/interfaces/agentic-message.ts` — `AgenticMessage` types (needed for conversation building)
- `src/interfaces/entities/agent-entity.ts` — `AgentEntity` with `tools`, `skillConfigs` (Task 02)

Confirm you understand:
- The RFC invocation sequence (RFC Section 10): Context Assembly → Transport → Agent Loop → Output → Skill Assertion → Observation & Lifecycle → Pipeline Continues
- The tool loop: when the agent yields a `tool-call` chunk, the framework executes the tool, builds a `tool-result` message, appends both to the conversation, and re-sends to the transport
- The retry loop: when output parsing succeeds but skill `.assert()` throws, the error is formatted as a user message, appended to conversation, and the agent is re-invoked (up to `maxRetries` times)
- Tool merging: available tools for an invocation = `agent.tools ∪ skill.tools ∪ (skillConfig.tools ?? [])`

---

## 2. Implementation

### 2.1 Create `src/core/agent-invocation.ts`

Implement an `invokeAgent` function that encapsulates the complete invocation lifecycle.

**Signature:**

```typescript
interface InvocationOptions<TState = unknown> {
  agent: AgentEntity
  skill: SkillEntity
  input: unknown
  conversation: Conversation
  transport: AgentTransport
  model: ModelEntity
  getState: () => TState
  use: Injector
  onEvent?: (event: BaseEvent) => void
}

interface InvocationResult {
  output: unknown
  conversation: Conversation
  chunks: AgentChunk[]
  tokenUsage: { input: number; output: number }
}

async function invokeAgent(options: InvocationOptions): Promise<InvocationResult>
```

**Logic (implement in this order):**

**Step 1: Gather tools.**
- Merge `agent.tools ?? []`, `skill.tools ?? []`, and `agent.skillConfigs?.get(skill.name)?.tools ?? []`
- Convert each `ToolEntity` to a `ToolSchema` for the transport: `{ name, description, parameters: toolEntity.inputSchema.toJsonSchema?.() ?? {} }`
- Build a lookup map: `Map<string, ToolEntity>` keyed by tool name

**Step 2: Build user message from skill input.**
- Create a `UserMessage`: `{ role: 'user', content: JSON.stringify(input), timestamp: Date.now() }`
- Append to conversation: `conversation = conversation.append(userMessage)`

**Step 3: Resolve model.**
- Priority: `agent.skillConfigs?.get(skill.name)?.model ?? agent.defaultModel ?? model`
- This gives the final `ModelEntity` for this invocation

**Step 4: Resolve transport.**
- Priority: `agent.skillConfigs?.get(skill.name)?.transport ?? agent.defaultTransport ?? transport`

**Step 5: Build TransportRequest and send.**
- Build `TransportRequest` with conversation, tools (as ToolSchema[]), model, temperature, outputFormat
- Call `transport.send(request)` to get `AsyncIterable<AgentChunk>`

**Step 6: Agent loop (tool calls).**
- Iterate over chunks from the transport
- Collect all chunks into an array (for output parsing later)
- Track token usage from `usage` chunks
- When a `tool-call` chunk arrives:
  a. Look up the tool in the tool map by name
  b. If not found, create an error tool-result message
  c. If found, validate the arguments against `tool.inputSchema.parse(JSON.parse(chunk.toolCall.arguments))`
  d. Execute `tool.execute(validatedInput, { getState, use, emit: onEvent ?? (() => {}) })`
  e. Append assistant message (with tool call) to conversation
  f. Append tool message (with result) to conversation
  g. Send updated conversation back to transport (new `transport.send()` call)
  h. Continue collecting chunks from the new stream
- When a `complete` chunk arrives, exit the loop

**Step 7: Parse output.**
- Call `parseAgentOutput(collectedChunks, skill.output)` (from Task 09)
- This extracts JSON from text chunks and validates against the skill's output schema

**Step 8: Skill assertion + retry loop.**
- If `skill.assert` is defined, call `skill.assert(parsedOutput, { use, getState })`
- If assertion passes, return the result
- If assertion throws and retries remain (`attempt < skill.maxRetries`):
  a. Format the error as a user message: `"Your output failed validation: {error.message}. Please try again."`
  b. Append the assistant response and the error feedback message to conversation
  c. Go back to Step 5 (re-send with updated conversation)
  d. Increment attempt counter
- If assertion throws and no retries remain, throw the error (invocation failed)

**Step 9: Return result.**
- Return `{ output, conversation, chunks, tokenUsage }`

**Important design constraints:**
- This function does NOT manage lifecycle state (tokens, failures, turns). The caller (Task 11's dispatcher) does that.
- This function does NOT emit observation events. The `onEvent` callback is how tool events are surfaced — the caller decides whether to emit them.
- This function is testable in isolation — it receives everything via params, no global state.

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Write a test file at `src/__tests__/agent-invocation.test.ts` that verifies:
  1. **Simple invocation (no tools, no retry):** mock transport yields `[text('{"code":"x"}'), complete()]`. Verify output is parsed and validated.
  2. **Tool call loop:** mock transport yields `[tool-call({id:'1', name:'ReadFile', arguments:'{"path":"a.ts"}'})]`, then on second send yields `[text('{"code":"done"}'), complete()]`. Verify the tool was executed, conversation has tool messages, output is correct.
  3. **Tool not found:** transport yields a tool-call for an unregistered tool. Verify an error tool-result is sent back.
  4. **Skill assertion pass:** skill has `.assert()` that does not throw. Verify output returned normally.
  5. **Skill assertion fail + retry:** skill `.assert()` throws on first attempt, passes on second. Mock transport returns different output on retry. Verify retry happened and final output is from second attempt.
  6. **Skill assertion exhausted:** `.assert()` always throws, `maxRetries: 2`. Verify error is thrown after 3 attempts (1 original + 2 retries).
  7. **Token usage accumulation:** multiple `usage` chunks across tool calls. Verify total usage is summed.
  8. **Conversation growth:** verify conversation has all messages (user, assistant, tool-call, tool-result, retry feedback) in correct order after invocation.
- Run tests: `npx jest src/__tests__/agent-invocation.test.ts`

---

## 4. Report

After completing the task, provide:
- Files created
- Test results
- Confirmation that `npx tsc --noEmit` passes
- The exact flow of the tool loop (which messages are appended to conversation and in what order)
- The exact flow of the retry loop (what the feedback message looks like)

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] Tool merge is correct: `agent.tools ∪ skill.tools ∪ skillConfig.tools`
- [ ] Tool lookup by name handles missing tools gracefully (error response, not crash)
- [ ] Tool arguments are validated against `tool.inputSchema` before execution
- [ ] Tool execution errors are caught and sent back as error tool-result messages
- [ ] Conversation grows correctly: user → assistant (with tool call) → tool (result) → next assistant response
- [ ] Retry loop appends both the failed assistant response AND the error feedback as separate messages
- [ ] Retry counter starts at 0, retries up to `maxRetries` times (so total attempts = maxRetries + 1)
- [ ] `onEvent` callback is called for tool events (if provided)
- [ ] Output parser is called with the FINAL stream's chunks (not intermediate tool-call streams)
- [ ] Conversation is returned in the result (caller needs it for lifecycle management)
- [ ] Function is pure — no side effects except tool execution and onEvent callback
- [ ] All 8 test cases pass

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. **Tool loop re-entry:** after a tool call, the function calls `transport.send()` again. Is the conversation correctly built for re-entry (assistant message with tool call, then tool result message)?
2. **Retry feedback formatting:** is the error message template appropriate? Should it be configurable?
3. **Chunk collection across tool loops:** when the agent makes multiple tool calls in sequence, are chunks from all iterations collected, or only from the final iteration?
4. **Error boundaries:** if a tool's `execute()` throws, is the error handled correctly (sent back as tool error, not crashing the invocation)?
5. **ToolSchema generation:** `toolEntity.inputSchema.toJsonSchema?.()` — does ZodSchema have this method? If not, how should we convert Zod schemas to JSON Schema for LLM function calling?
6. Is this function too large? Should it be decomposed into smaller helpers?
