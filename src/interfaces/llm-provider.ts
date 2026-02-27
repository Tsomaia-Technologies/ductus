/**
 * LLMProvider - abstract contract for physical network execution.
 * Injected via constructor. Implement with @anthropic-ai/sdk, openai, etc.
 * RFC-001 Task 014-agent-dispatcher.
 */

export interface LLMStreamOptions {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  model: string;
  maxTokens: number;
  signal?: AbortSignal;
}

/** Thrown by provider. statusCode 429/529 triggers strategy fallback. */
export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}

export interface LLMProvider {
  /** Stream tokens. Throws LLMProviderError on 429/529 (caller handles fallback). */
  stream(options: LLMStreamOptions): AsyncIterable<string>;
}
