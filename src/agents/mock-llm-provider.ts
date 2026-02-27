/**
 * MockLLMProvider - for tests. Configurable to simulate streaming, abort, rate limit.
 * RFC-001 Task 014-agent-dispatcher, Implementation Guide 5.2.
 */

import type {
  LLMProvider,
  LLMStreamOptions,
} from "../interfaces/llm-provider.js";
import { LLMProviderError } from "../interfaces/llm-provider.js";

export interface MockLLMProviderConfig {
  /** If true, throw 429 on first call (triggers fallback). */
  rateLimitFirstCall?: boolean;
  /** If true, throw 500 on calls (triggers retry). */
  serverError?: boolean;
  /** Delay between token emits (ms). Use to test abort during stream. */
  tokenDelayMs?: number;
  /** Full response to emit as tokens. */
  response?: string;
  /** Called when stream() is invoked - for assertions. */
  onStreamCall?: (opts: LLMStreamOptions) => void;
}

export class MockLLMProvider implements LLMProvider {
  private readonly config: MockLLMProviderConfig;
  public streamCallCount = 0;

  constructor(config: MockLLMProviderConfig = {}) {
    this.config = config;
  }

  async *stream(opts: LLMStreamOptions): AsyncIterable<string> {
    this.streamCallCount++;
    this.config.onStreamCall?.(opts);

    if (this.config.rateLimitFirstCall && this.streamCallCount === 1) {
      throw new LLMProviderError("Rate limited", 429);
    }

    if (this.config.serverError) {
      throw new LLMProviderError("Internal Server Error", 500);
    }

    const text = this.config.response ?? '{"files":[]}';
    const delay = this.config.tokenDelayMs ?? 0;

    for (const char of text) {
      if (opts.signal?.aborted) {
        return;
      }
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
      if (opts.signal?.aborted) {
        return;
      }
      yield char;
    }
  }
}
