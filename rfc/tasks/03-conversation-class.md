# Task 03 — Conversation Class Implementation

**Phase:** 1 (Foundational Primitives)
**Depends on:** Task 00 (Conversation interface)
**Blocks:** Tasks 05, 09, 10, 11
**Parallelizable with:** Tasks 04, 05

---

## Objective

Implement the `Conversation` class — an immutable data structure with structural sharing for managing agent conversation history. Every operation returns a new `Conversation`; no mutation methods exist. The transport receives a `Conversation` reference and cannot corrupt framework state.

---

## 1. Exploration

Before writing any code, read and understand these files:

- `src/interfaces/conversation.ts` — the interface this class must implement (created in Task 00)
- `src/interfaces/agentic-message.ts` — the `AgenticMessage` union (System, User, Assistant, Tool messages)
- `src/core/linked-list.ts` — existing linked list implementation (for reference on structural patterns, but Conversation uses its own node structure)

Confirm you understand:
- The `Conversation` interface: `systemMessage`, `messages`, `tokenEstimate`, `length`, `append()`
- The `ConversationNode` structure: `{ message, prev }` — a singly-linked chain where `append()` creates a new head node pointing to the old chain
- Why structural sharing matters: `append()` must be O(1), previous `Conversation` instances must remain valid with their original data
- The `messages` getter materializes the linked list into a frozen array (O(n)) — this runs only when the transport needs the full list

---

## 2. Implementation

### 2.1 Create `src/core/conversation.ts`

Implement the `Conversation` class that fulfills the `Conversation` interface from `src/interfaces/conversation.ts`.

**Requirements:**

1. **Constructor is private.** Instances are created via static `Conversation.create(systemMessage)`.
2. **`append(message)` returns a new `Conversation`.** It creates a new `ConversationNode` whose `prev` points to the current head. This is O(1) — no copying of existing messages.
3. **`get messages()` materializes the chain** into a `readonly AgenticMessage[]`. Traverse from head to tail (following `prev` pointers), collect into an array, reverse it (since head is the newest), and freeze it with `Object.freeze()`. This is O(n).
4. **`tokenEstimate`** is maintained incrementally. Each `append()` adds the estimate for the new message. Use a simple heuristic: `Math.ceil(message.content.length / 4)` (roughly 4 chars per token). This is a placeholder — the framework may later accept a custom estimator.
5. **`systemMessage`** is set at creation time and is immutable.
6. **`length`** tracks the number of messages (not counting the system message).

**Structural sharing invariant:** if `conv2 = conv1.append(msg)`, then `conv1.length` is unchanged, `conv1.messages` returns the same messages as before, and `conv2.messages` returns `conv1.messages` plus the new message. They share the same underlying node chain up to the divergence point.

**Edge cases:**
- `Conversation.create('...').messages` returns an empty frozen array
- `Conversation.create('...').length` returns 0
- `Conversation.create('...').tokenEstimate` returns 0 (system message tokens are not counted in `tokenEstimate` — only conversation messages)

---

## 3. Checks

- Run `npx tsc --noEmit` — must pass.
- Write a test file at `src/__tests__/conversation.test.ts` that verifies:
  1. **Immutability:** `conv1.append(msg)` does not mutate `conv1`.
  2. **Structural sharing:** `conv2 = conv1.append(msg)` — `conv1.length` is still the original, `conv2.length` is original + 1.
  3. **Message ordering:** messages are returned in chronological order (oldest first).
  4. **Frozen output:** `conv.messages` returns a frozen array (`Object.isFrozen(conv.messages)` is `true`).
  5. **Empty state:** `Conversation.create('sys').messages` is `[]`, `.length` is `0`.
  6. **Token estimation:** appending a message with 400 characters increases `tokenEstimate` by approximately 100.
  7. **System message preservation:** `conv.systemMessage` returns the string passed to `create()`.
  8. **Chain of appends:** create a conversation, append 100 messages, verify all 100 are present in order.
- Run the test: `npx jest src/__tests__/conversation.test.ts`

---

## 4. Report

After completing the task, provide:
- The file created (`src/core/conversation.ts`)
- The test file created (`src/__tests__/conversation.test.ts`)
- Test results (all passing)
- Confirmation that `npx tsc --noEmit` passes
- The Big-O complexity of `append()` and `messages` getter

---

## 5. Self-Review

Before requesting manual review, verify:
- [ ] Constructor is private — no `new Conversation()` from outside the class
- [ ] `create()` is a static factory method
- [ ] `append()` returns a new instance, does not modify `this`
- [ ] `messages` getter returns `readonly AgenticMessage[]` (frozen)
- [ ] `messages` are in chronological order (oldest first, newest last)
- [ ] Token estimation uses a simple heuristic (not an external library)
- [ ] The class implements the `Conversation` interface from `src/interfaces/conversation.ts`
- [ ] No mutable public properties exist on the class
- [ ] All tests pass

---

## 6. Manual Review Request

After self-review passes, request zero-trust manual review. Highlight:
1. The structural sharing implementation — is the linked-list node chain correct?
2. The token estimation heuristic — is `Math.ceil(content.length / 4)` reasonable as a placeholder?
3. Whether `messages` should cache the materialized array (trade memory for repeated access speed) or always re-traverse
4. Whether `systemMessage` should be included in `tokenEstimate` or kept separate (current design: separate)
