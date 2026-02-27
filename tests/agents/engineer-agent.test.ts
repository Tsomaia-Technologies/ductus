/**
 * EngineerAgent Definition of Done.
 * Task 013-agent-role-contracts.
 */

import { EngineerAgent } from "../../src/agents/engineer-agent.js";
import { AgentParseError } from "../../src/agents/agent-parse-error.js";

describe("EngineerAgent", () => {
  const agent = new EngineerAgent();

  describe("The Formatting Recovery Proof", () => {
    it("strips markdown wrapping and returns { files: ['a.ts'] }", () => {
      const raw = "```json\n{ \"files\": [\"a.ts\"] }\n```";
      const result = agent.parse(raw);
      expect(result).toEqual({ files: ["a.ts"] });
    });

    it("handles inline json block format", () => {
      const raw = "```json { \"files\": [\"a.ts\"] } ```";
      const result = agent.parse(raw);
      expect(result).toEqual({ files: ["a.ts"] });
    });

    it("raw text refusal throws AgentParseError", () => {
      expect(() => agent.parse("I'm sorry, I can't do that")).toThrow(
        AgentParseError
      );
    });

    it("AgentParseError captures rawResponse", () => {
      try {
        agent.parse("I'm sorry, I can't do that");
      } catch (e) {
        expect(e).toBeInstanceOf(AgentParseError);
        expect((e as AgentParseError).rawResponse).toBe(
          "I'm sorry, I can't do that"
        );
      }
    });
  });
});
