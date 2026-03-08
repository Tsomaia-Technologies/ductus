/**
 * AgentDispatcher Definition of Done.
 * Task 014-agent-dispatcher.
 */

import { AgentDispatcherImpl } from "../../research/agents/agent-dispatcher.js";
import { EngineerAgent } from "../../research/agents/engineer-agent.js";
import { MockLLMProvider } from "../../research/agents/mock-llm-provider.js";
import type { AgentContext } from "../../research/interfaces/agent-context.js";
import type { AgentStreamEvent } from "../../research/interfaces/agent-stream-event.js";
import type { EngineerReportOutput } from "../../research/agents/engineer-agent.js";

function countTokensAlways100(_text: string): number {
  return 100;
}

/** For truncation proof: 50 each => sys+input=100, 3 msgs=150, total 250 < 350. Drops oldest 2. */
function countTokens50(_text: string): number {
  return 50;
}

describe("AgentDispatcher", () => {
  const strategies = [
    { id: "s1", model: "claude-3", template: "" },
    { id: "s2", model: "gpt-4", template: "" },
  ];

  describe("The Truncation Algorithm Proof", () => {
    it("drops exactly the oldest 2 messages when (500 tokens -> 300) < 350", async () => {
      const messagesReceived: Array<{ role: string; content: string }>[] = [];
      const mockProvider = new MockLLMProvider({
        onStreamCall: (opts) => {
          messagesReceived.push([...opts.messages]);
        },
        response: '{"files":["a.ts"]}',
      });

      const dispatcher = new AgentDispatcherImpl({
        tokenCounter: countTokens50,
        provider: mockProvider,
        strategies,
      });

      const context: AgentContext = {
        messages: [
          { role: "user", content: "m0", timestamp: 0 },
          { role: "assistant", content: "m1", toolCalls: [], timestamp: 1 },
          { role: "user", content: "m2", timestamp: 2 },
          { role: "assistant", content: "m3", toolCalls: [], timestamp: 3 },
          { role: "user", content: "m4", timestamp: 4 },
        ],
        stats: { inputTokens: 0, outputTokens: 0, turns: 0 },
      };

      const role = new EngineerAgent();
      const stream = dispatcher.process(
        "input",
        role,
        context,
        { maxTokens: 250 }
      );

      const events: AgentStreamEvent<EngineerReportOutput>[] = [];
      for await (const e of stream) {
        events.push(e);
      }

      expect(events[events.length - 1]).toEqual({
        type: "complete",
        parsedOutput: { files: ["a.ts"] },
      });
      expect(messagesReceived).toHaveLength(1);
      const msgs = messagesReceived[0]!;
      expect(msgs).toHaveLength(4);
      expect(msgs[0]!.content).toBe("m2");
      expect(msgs[1]!.content).toBe("m3");
      expect(msgs[2]!.content).toBe("m4");
      expect(msgs[3]!.content).toBe("input");
    });
  });

  describe("The Panic Abort Proof", () => {
    it("cleanly closes when AbortSignal fires; generator exits without throwing", async () => {
      const ac = new AbortController();
      const mockProvider = new MockLLMProvider({
        tokenDelayMs: 50,
        response: "slow",
      });

      const dispatcher = new AgentDispatcherImpl({
        tokenCounter: countTokensAlways100,
        provider: mockProvider,
        strategies,
      });

      const stream = dispatcher.process(
        "x",
        new EngineerAgent(),
        undefined,
        { maxTokens: 4096, signal: ac.signal }
      );

      const tokens: string[] = [];
      const consumed = (async () => {
        for await (const e of stream) {
          if (e.type === "token") tokens.push(e.content);
        }
      })();

      await new Promise((r) => setTimeout(r, 10));
      ac.abort();

      await expect(consumed).resolves.not.toThrow();
    });
  });
});
