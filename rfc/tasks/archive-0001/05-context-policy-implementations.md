# Task 05 — Context Policy Implementations

**Phase:** 1 (Foundational Primitives)
**Depends on:** Task 00 (Conversation interface, AgentTransport interface), Task 02 (ContextPolicy interface), Task 03 (Conversation class)
**Blocks:** Task 11
**Parallelizable with:** Task 04 (if Task 03 is complete)

---

## Objective

Implement the four context policy strategies that determine how the framework manages conversation history when approaching token limits. Each implements the `ContextPolicy` interface from `src/interfaces/context-policy.ts`.

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/interfaces/context-policy.ts` — the `ContextPolicy` interface (created in Task 02)
- `src/interfaces/conversation.ts` — the `Conversation` interface (created in Task 00)
- `src/core/conversation.ts` — the `Conversation` class (created in Task 03)
- `src/interfaces/agent-transport.ts` — the `AgentTransport` interface (created in Task 00)
- `src/interfaces/agentic-message.ts` — `AgenticMessage` types (needed for constructing messages)

Confirm you understand:
- `ContextPolicy.apply(conversation, limit, transport)` returns a new `Conversation` that fits within the token limit
- `Conversation` is immutable — policies must build a new `Conversation` from scratch (using `Conversation.create()` + repeated `.append()`)
- Only `SummarizeContextPolicy` uses the `transport` parameter — it needs to invoke the LLM to produce a summary
- The `limit` parameter is `maxContextTokens` from the agent entity

---

## 2. Implementation

### 2.1 Create `src/core/context-policies/replace-context-policy.ts`

**Behavior:** Returns a fresh conversation with only the system message. This is the nuclear option — the existing conversation is discarded entirely. Used in conjunction with the handoff mechanism (the new adapter gets handoff context in its system message).

**Key details:**
- Receives the current conversation and the limit
- Returns `Conversation.create(conversation.systemMessage)` — a brand new empty conversation
- Does not use the `transport` parameter
- Constructor takes no options

### 2.2 Create `src/core/context-policies/truncate-context-policy.ts`

**Behavior:** Keeps the system message and the last N messages that fit within the token limit. Removes oldest messages first.

**Key details:**
- Iterates messages from newest to oldest
- Accumulates token estimates until approaching the limit
- Builds a new `Conversation` with only the retained messages (in chronological order)
- Constructor optionally accepts `{ preserveLastN?: number }` — minimum number of recent messages to always keep, regardless of token count
- Does not use the `transport` parameter

### 2.3 Create `src/core/context-policies/sliding-window-context-policy.ts`

**Behavior:** Always keeps the last N tokens worth of messages. Unlike truncate, this runs on every invocation (not just when the limit is exceeded), ensuring the conversation never grows beyond the window.

**Key details:**
- Takes `{ windowTokens: number }` in constructor
- On every `apply()`, keeps only messages that fit within `windowTokens`
- Works from newest to oldest, same as truncate
- Does not use the `transport` parameter

### 2.4 Create `src/core/context-policies/summarize-context-policy.ts`

**Behavior:** Asks the agent to summarize the conversation, then replaces history with the summary as a single assistant message.

**Key details:**
- Constructor accepts `{ targetTokens?: number, preserveLastN?: number }` — `targetTokens` is the target size after summarization, `preserveLastN` keeps the N most recent messages verbatim after the summary
- Uses `transport.send()` to invoke the LLM with a summarization prompt
- The summarization request sends the full conversation with a user message asking for a summary
- Collects text chunks from the transport response and joins them into a summary string
- Builds a new `Conversation`: system message + one assistant message (the summary) + the preserved last N messages
- The summarization prompt should be a hardcoded framework string (e.g., "Summarize the conversation so far concisely, preserving key decisions, context, and outputs.")

### 2.5 Create `src/core/context-policies/index.ts`

Re-export all four policies from a barrel file for clean imports.

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Write a test file at `src/__tests__/context-policies.test.ts` that verifies:
  1. **ReplaceContextPolicy:** returns a conversation with 0 messages but the same system message.
  2. **TruncateContextPolicy:** with a limit of 100 tokens and a conversation with 500 tokens of messages, the result has fewer messages and fits within the limit.
  3. **TruncateContextPolicy with preserveLastN:** even if the last 3 messages exceed the limit, they are preserved.
  4. **SlidingWindowContextPolicy:** always returns a conversation within the window size.
  5. **SummarizeContextPolicy:** mock the transport to return a summary, verify the result conversation contains the summary message + preserved messages.
- Run tests: `npx jest src/__tests__/context-policies.test.ts`

---

## 4. Report

After completing the task, provide:
- List of files created
- Test results
- Confirmation that `npx tsc --noEmit` passes
- Any edge cases discovered during implementation

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] All four policies implement `ContextPolicy` from `src/interfaces/context-policy.ts`
- [ ] `ReplaceContextPolicy` discards all messages, returns fresh conversation
- [ ] `TruncateContextPolicy` keeps newest messages that fit within the limit
- [ ] `SlidingWindowContextPolicy` enforces a fixed window on every call
- [ ] `SummarizeContextPolicy` actually calls `transport.send()` and collects the response
- [ ] All policies return a `Conversation` instance (not a plain object)
- [ ] All policies preserve `systemMessage` unchanged
- [ ] Messages in the result are in chronological order
- [ ] The barrel file exports all four policies
- [ ] All tests pass

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. `SummarizeContextPolicy` — is the summarization prompt appropriate? Should it be configurable?
2. `SummarizeContextPolicy` — how should errors during summarization be handled? (transport fails, LLM returns garbage)
3. Token estimation accuracy — policies rely on `Conversation.tokenEstimate`. Is this sufficient, or should policies accept a custom token counter?
4. `TruncateContextPolicy` vs `SlidingWindowContextPolicy` — is the distinction clear enough, or could they be merged into one configurable policy?
