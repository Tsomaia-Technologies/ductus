/**
 * AgentDispatcher - physical network execution engine.
 * Wraps LLM providers, truncates context, handles abort/retry/fallback.
 * RFC-001 Task 014-agent-dispatcher, Implementation Guide Phase 4.
 */

import type { AgentContext } from "../interfaces/agent-context.js";
import type { AgentRole } from "../interfaces/agent-role.js";
import type { AgentStreamEvent } from "../interfaces/agent-stream-event.js";
import type { LLMProvider } from "../interfaces/llm-provider.js";
import { LLMProviderError } from "../interfaces/llm-provider.js";

const RETRY_DELAY_MS = 2000;

export interface RoleStrategy {
  id: string;
  model: string;
  template: string;
}

export interface AgentDispatcherConfig {
  tokenCounter: (text: string) => number;
  provider: LLMProvider;
  strategies: RoleStrategy[];
}

/** Convert AgenticMessage to provider message shape (content only for token counting). */
function toProviderMessage(
  m: { role: string; content: string }
): { role: "user" | "assistant" | "system"; content: string } {
  const role: "user" | "assistant" | "system" =
    m.role === "tool" ? "user" : (m.role as "user" | "assistant" | "system");
  return { role, content: m.content };
}

/** Drop oldest messages until total tokens <= maxTokens. Keeps newest. */
function truncateHistory(
  messages: Array<{ role: string; content: string }>,
  systemTokens: number,
  inputTokens: number,
  maxTokens: number,
  tokenCounter: (s: string) => number
): Array<{ role: string; content: string }> {
  const fixed = systemTokens + inputTokens;
  if (fixed >= maxTokens) return [];

  let total = fixed;
  let start = messages.length;
  const n = messages.length;
  for (let i = n - 1; i >= 0; i--) {
    const t = tokenCounter(messages[i]!.content);
    if (total + t <= maxTokens) {
      total += t;
      start = i;
    } else {
      break;
    }
  }
  const out: Array<{ role: string; content: string }> = [];
  for (let i = start; i < n; i++) {
    out.push(messages[i]!);
  }
  return out;
}

export class AgentDispatcherImpl {
  private readonly tokenCounter: (text: string) => number;
  private readonly provider: LLMProvider;
  private readonly strategies: RoleStrategy[];
  private readonly activeAborts = new Map<AgentRole<unknown>, AbortController>();

  constructor(config: AgentDispatcherConfig) {
    this.tokenCounter = config.tokenCounter;
    this.provider = config.provider;
    this.strategies = config.strategies;
  }

  process<TOutput>(
    input: string,
    role: AgentRole<TOutput>,
    context: AgentContext | undefined,
    options: {
      signal?: AbortSignal;
      maxTokens: number;
      maxRetries?: number;
    }
  ): AsyncIterableIterator<AgentStreamEvent<TOutput>> {
    const maxRetries = options.maxRetries ?? 2;
    const self = this;
    const gen = (async function* (): AsyncGenerator<
      AgentStreamEvent<TOutput>
    > {
      const ctx = context ?? {
        messages: [],
        stats: { inputTokens: 0, outputTokens: 0, turns: 0 },
      };
      const allMessages = ctx.messages;
      const systemTokens = self.tokenCounter(role.systemPrompt);
      const inputTokens = self.tokenCounter(input);
      const truncated = truncateHistory(
        allMessages,
        systemTokens,
        inputTokens,
        options.maxTokens,
        self.tokenCounter
      );
      const providerMessages = truncated.map(toProviderMessage);

      const internalAc = new AbortController();
      const externalSignal = options.signal;
      const combinedSignal = (() => {
        if (externalSignal == null) return internalAc.signal;
        if (externalSignal.aborted) return internalAc.signal;
        externalSignal.addEventListener("abort", () => internalAc.abort());
        return internalAc.signal;
      })();
      self.activeAborts.set(role, internalAc);

      let lastError: Error | null = null;
      const strategyCount = self.strategies.length;

      for (let s = 0; s < strategyCount; s++) {
        const strategy = self.strategies[s]!;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            if (combinedSignal.aborted) {
              self.activeAborts.delete(role);
              return;
            }
            const streamOpts = {
              systemPrompt: role.systemPrompt,
              messages: [
                ...providerMessages,
                { role: "user" as const, content: input },
              ],
              model: strategy.model,
              maxTokens: options.maxTokens,
              signal: combinedSignal,
            };
            let accumulated = "";
            const stream = self.provider.stream(streamOpts);
            for await (const token of stream) {
              if (combinedSignal.aborted) {
                self.activeAborts.delete(role);
                return;
              }
              accumulated += token;
              yield { type: "token", content: token };
            }
            const parsed = role.parse(accumulated);
            self.activeAborts.delete(role);
            yield { type: "complete", parsedOutput: parsed };
            return;
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
              self.activeAborts.delete(role);
              return;
            }
            lastError = err instanceof Error ? err : new Error(String(err));
            const status =
              err instanceof LLMProviderError ? err.statusCode : undefined;
            if (status === 429 || status === 529) {
              break;
            }
            if (attempt < maxRetries) {
              await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            }
          }
        }
      }

      self.activeAborts.delete(role);
      yield {
        type: "failure",
        error: lastError?.message ?? "Agent failure",
      };
    })();
    return gen;
  }

  terminate(role: AgentRole<unknown>): void {
    const ac = this.activeAborts.get(role);
    if (ac) {
      ac.abort();
      this.activeAborts.delete(role);
    }
  }
}
