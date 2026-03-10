# R04 — Support Parallel Tool Calls

**Severity:** HIGH
**Audit ref:** H2
**Depends on:** None
**Blocks:** None

---

## Problem

`runToolLoop` in `src/core/agent-invocation.ts` (lines 132-134) overwrites `pendingToolCall` on every `tool-call` chunk. If an LLM yields multiple tool calls in a single response (parallel tool calling — common with GPT-4 and Claude), only the last tool call is executed. All earlier tool calls are silently dropped.

---

## 1. Exploration

Read and understand:

- `src/core/agent-invocation.ts` — `runToolLoop()`, specifically the chunk iteration loop
- How LLMs emit parallel tool calls (multiple `tool-call` chunks in one response, each with a unique `id`)
- `src/interfaces/agentic-message.ts` — `AssistantMessage.toolCall` is singular (only holds one tool call)

---

## 2. Implementation

### 2.1 Collect all tool calls per response

Replace the single `pendingToolCall` variable with an array:

```typescript
const pendingToolCalls: AgentToolCall[] = []

// In the chunk loop:
if (chunk.type === 'tool-call') {
  pendingToolCalls.push(chunk.toolCall)
}
```

### 2.2 Execute all tool calls

After the chunk loop, if `pendingToolCalls.length > 0`, execute all of them:

```typescript
if (pendingToolCalls.length === 0) {
  return { conv: currentConv, finalChunks: currentChunks }
}

// Append assistant message with first tool call (or all — see 2.3)
// Execute each tool call and append tool result messages
for (const toolCall of pendingToolCalls) {
  // execute tool, append messages...
}
```

### 2.3 Update AssistantMessage to support multiple tool calls

Currently `AssistantMessage.toolCall` is a single optional `AgentToolCall`. For parallel tool calls, consider:

**Option A:** Change to `toolCalls?: AgentToolCall[]` (breaking change to message type)
**Option B:** Keep single `toolCall` on message but create one assistant message per tool call (matches some LLM API patterns)
**Option C:** Add a new field `toolCalls?: AgentToolCall[]` alongside the existing `toolCall?` (backward compat)

Evaluate which option best matches the LLM API patterns (OpenAI uses a single assistant message with multiple tool calls).

### 2.4 Update `newFromIndex` calculation

After processing N tool calls, `newFromIndex` should point to the start of the new messages (1 assistant + N tool results = N+1 new messages).

---

## 3. Checks

- `npx tsc --noEmit` — must pass
- Write a test with a mock transport that yields 2 tool-call chunks in a single response
- Verify both tools are executed and both results appear in the conversation
- Verify the next transport `send()` receives the conversation with all tool-call/result pairs
- Run existing tests (update if `AssistantMessage` shape changed)

---

## 4. Report

- Option chosen for `AssistantMessage` (A, B, or C)
- Files modified
- Test results

---

## 5. Self-Review

- [ ] Multiple tool calls in one response are all executed
- [ ] Each tool call gets its own tool result message in the conversation
- [ ] The next transport request includes all tool-call/result pairs
- [ ] Single tool call behavior is unchanged (no regression)
- [ ] `newFromIndex` is calculated correctly for N tool calls

---

## 6. Manual Review Request

Highlight:
1. Does the chosen `AssistantMessage` approach match OpenAI/Anthropic API patterns?
2. Are parallel tool calls executed sequentially or concurrently?
3. Should tool execution order match the order in the response?
