/**
 * AuditorAgent Definition of Done.
 * Task 018-quality-processor (Auditor role).
 */

import { AuditorAgent } from "../../research/agents/auditor-agent.js";
import { AgentParseError } from "../../research/agents/agent-parse-error.js";

describe("AuditorAgent", () => {
  const agent = new AuditorAgent();

  it("parses approved report", () => {
    const raw = '```json\n{ "approved": true }\n```';
    const result = agent.parse(raw);
    expect(result).toEqual({ approved: true });
  });

  it("parses rejected report with critique", () => {
    const raw = '```json\n{ "approved": false, "critique": "Missing auth flow" }\n```';
    const result = agent.parse(raw);
    expect(result).toEqual({ approved: false, critique: "Missing auth flow" });
  });

  it("throws AgentParseError for invalid JSON", () => {
    expect(() => agent.parse("not json")).toThrow(AgentParseError);
  });
});
