/**
 * MockAgentDispatcher - hardcoded JSON fixture responses for CI/CD.
 * Does not hit real LLM endpoints. RFC-001 Implementation Guide 5.2.
 */

import type { AgentContext } from "../interfaces/agent-context.js";
import type { AgentRole } from "../interfaces/agent-role.js";
import type { AgentStreamEvent } from "../interfaces/agent-stream-event.js";

export interface MockAgentDispatcherConfig {
  /** Hardcoded response. Emitted as single token then complete. */
  response?: string;
  /** If set, yield failure instead of complete. */
  failWith?: string;
}

export class MockAgentDispatcher {
  private readonly config: MockAgentDispatcherConfig;

  constructor(config: MockAgentDispatcherConfig = {}) {
    this.config = config;
  }

  async *process<TOutput>(
    _input: string,
    role: AgentRole<TOutput>,
    _context: AgentContext | undefined,
    _options: { signal?: AbortSignal; maxTokens: number; maxRetries?: number }
  ): AsyncIterableIterator<AgentStreamEvent<TOutput>> {
    if (this.config.failWith != null) {
      yield { type: "failure", error: this.config.failWith };
      return;
    }
    const raw = this.config.response ?? '{"files":[]}';
    yield { type: "token", content: raw };
    const parsed = role.parse(raw);
    yield { type: "complete", parsedOutput: parsed };
  }

  terminate(_role: AgentRole<unknown>): void {
    /* no-op */
  }
}
