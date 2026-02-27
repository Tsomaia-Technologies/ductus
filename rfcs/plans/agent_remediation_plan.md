# Phase 4 Remediation Plan: The Intelligence Layer (Agent Adapters)

## The Problem
The current `AgentDispatcher` implementation violates the Single Responsibility Principle and ignores the RFC-001 mapping for execution lifecycles (`single-shot` vs `session`). Currently, the system over-indexes on stateless API calls (HTTP logic), entirely omitting the ability to support stateful, long-running CLI agents (like `cursor` or `claude-code`) via raw process pipes. 

`src/interfaces/agent.ts` was correctly drafted to represent this execution layer but was orphaned.

## The Strategy: The Adapter Pattern
We must decouple the Orchestrator (`AgentDispatcher`) from the Execution Physics (CLI vs REST). We will implement a rigid class hierarchy that explicitly separates the `Lifecycle Strategy` from the `Transport Mechanism`.

---

## Proposed Architectural Changes

### 1. Establish the Root Contracts (The Bridge Pattern)
We will split the responsibilities: **Agents** manage state and lifecycle (Single-Shot vs Session), while **Channels** manage the physical transport of data (CLI pipes vs REST API sockets).

#### [NEW] `src/interfaces/agent-channel.ts`
The physical transport layer defining *how* we talk.
```typescript
export interface ChannelOptions {
  abort?: AbortSignal;
}

export interface AgentChannel {
  /** Opens the pipe or HTTP socket */
  connect(): Promise<void>;
  
  /** Sends raw string payload and yields raw string chunks back */
  send(payload: string, options?: ChannelOptions): AsyncIterableIterator<string>;
  
  /** Safely closes the pipe or socket */
  disconnect(): Promise<void>;
}
```

#### [MODIFY] `src/interfaces/agent.ts`
The state layer defining *what* the Agent does (managing history, parsing JSON, deciding when the turn ends).
```typescript
import { AgentContext } from './agent-context.js'
import { AgentStreamEvent } from './agent-stream-event.js'
import { AgentRole } from './agent-role.js'
import { AgentChannel } from './agent-channel.js'

export interface AgentExecutionOptions {
  abort?: AbortSignal;
}

export interface Agent {
  /** Stores context and receives its injected physical channel */
  initialize(context: AgentContext, channel: AgentChannel): Promise<void>;

  /** Formats the prompt, sends via channel, and yields strongly-typed events */
  process(
    input: string, 
    role: AgentRole<unknown>, 
    options: AgentExecutionOptions
  ): AsyncIterableIterator<AgentStreamEvent<unknown>>;

  /** Clears history and cleans up */
  terminate(): Promise<void>;
}
```

---

### 2. Implement the Physical Channels (The Transport)

#### [NEW] `src/agents/channels/cli-channel.ts`
- Implements `AgentChannel`.
- Uses Node's `spawn` to start interactive CLI tools (e.g., `cursor --interactive` or `claude-code`).
- `send()` writes to the child's `stdin` and reads `stdout` chunks until completion.
- `disconnect()` sends `SIGTERM` to the child process.

#### [NEW] `src/agents/channels/api-channel.ts` (Deferred to Phase 4.2)
- Implements `AgentChannel`.
- `send()` wraps the HTTP `fetch` to OpenAI/Anthropic and yields SSE raw chunks.

---

### 3. Implement the Logical Agents (The Lifecycle)

#### [NEW] `src/agents/implementations/single-shot-agent.ts`
- Implements `Agent`.
- **Contract:** Atomic execution. 
- In `process()`, it calls `channel.connect()`, writes the full formatted prompt via `channel.send()`, yields the tokens, and immediately calls `channel.disconnect()` before returning. 

#### [NEW] `src/agents/implementations/session-agent.ts`
- Implements `Agent`.
- **Contract:** Persistent execution.
- `initialize()` calls `channel.connect()` *once* to establish the long-lived process.
- `process()` calls `channel.send()` to emit the new turn over the open pipe, formats the turn-completion signal, and yields the response.
- `terminate()` explicitly calls `channel.disconnect()`.

---

### 4. Refactor the Dispatcher (The Content Router)
Strip execution logic out of the Dispatcher. It acts purely as a Dependency Injection router reading from Config.

#### [MODIFY] `src/agents/agent-dispatcher.ts`
- **Routing Logic:** When `process()` is invoked, the Dispatcher reads `ductus.config.ts`.
  - Determines Transport: If `type: "cli"`, instantiates `CliChannel`.
  - Determines Lifecycle: If `lifecycle: "session"`, instantiates `SessionAgent`, otherwise `SingleShotAgent`.
- **Injection:** `agent.initialize(context, channel)`
- **Delegation:** Forwards `agent.process()` and yields the native stream back up to the Hub.

---

## Verification Plan

### Automated Tests
1. **Dispatcher Routing:** Unit test the `AgentDispatcher` with mock configs to prove it instantiates the correct adapter subclass based on `type` and `lifecycle`.
2. **Adapter Contracts:** Test the `AbstractSessionAdapter` child classes to ensure `initialize()` throws if called twice, and `terminate()` successfully kills the mocked child processes.

### Manual Verification
1. Configure `ductus.config.ts` to use a trivial CLI tool (e.g., a simple bash script that echoes stdin) marked as `lifecycle: "session"`.
2. Observe the CLI tool persisting across multiple conversational turns without exiting.

---

## Appendix: Deprecation of `LLMProvider`

**What is `LLMProvider`?**
`LLMProvider` (`src/interfaces/llm-provider.ts`) is a legacy boundary created by the agents. It is strictly an API-based construct (e.g., defining `options.messages` array and `maxTokens`) designed to wrap the Anthropic or OpenAI SDKs.

**The CLI-First Priority:**
Because our explicit priority is standing up CLI-based agents (Cursor, Claude Code), `LLMProvider` is irrelevant to the initial execution. 
- Phase 4.1 will focus entirely on implementing the `AbstractSessionAdapter` and the concrete `CliSessionAdapter` (Cursor).
- When the time comes to support raw API calls, the physical functionality of `LLMProvider` will be strictly encapsulated *inside* the `ApiSingleShotAdapter` and `ApiSessionAdapter`. It will no longer exist as a global interface required by the Dispatcher.

---

## Appendix B: Processor Backpressure Remediation

**The Backpressure Violation:**
During the Phase 3 surgical remediation to rip out the Hub dependency, the agents implemented a flawed generic wrapper across the processors:
```typescript
async *process(stream: InputEventStream): OutputEventStream {
  // Fire-and-forget background consumer
  this.consume(stream).catch(console.error);

  // Foreground yielder
  for await (const out of this.outQueue) {
    yield out;
  }
}
```
This physically works to bypass deadlock, but it totally diminishes the core benefits of native Node.js async generators. It breaks the underlying backpressure mechanics by buffering everything into a rogue `outQueue` while discarding the safety of sequential event processing and explicit `await` boundaries.

**The Fix:**
Processors must be refactored back to the native paradigm using standard loops or explicit async iteration without detaching execution into fire-and-forget promises. 

If a processor needs concurrent operation (e.g., `ToolProcessor` running multiple timers/processes, or `AgentProcessor` spawning agents), they must use safe `Promise.race` handlers or a proper async semaphore generator that explicitly honors the Node `yield` backpressure, rather than breaking the loop context with `this.consume().catch()`. 

The `outQueue` pattern must be ripped completely out of all 10 edge processors.
