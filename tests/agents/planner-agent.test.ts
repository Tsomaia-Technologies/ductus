/**
 * PlannerAgent Definition of Done.
 * Task 013-agent-role-contracts.
 */

import { PlannerAgent } from "../../research/agents/planner-agent.js";

const FORBIDDEN_STATE_KEYS = ["history", "messages", "context", "tokens", "buffer"];

describe("PlannerAgent", () => {
  describe("The Stateless Proof", () => {
    it("has no instance properties managing arrays or conversation state", () => {
      const agent = new PlannerAgent();
      for (const key of FORBIDDEN_STATE_KEYS) {
        expect((agent as unknown as Record<string, unknown>)[key]).toBeUndefined();
      }
      expect(agent.name).toBe("planner");
      expect(agent.systemPrompt).toContain("Architect");
      expect(agent.allowedTools).toContain("fs_read");
    });
  });
});
