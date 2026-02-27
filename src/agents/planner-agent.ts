/**
 * PlannerAgent - Read-Only Architect.
 * Output: TechnicalSpec (Markdown). Stateless, no I/O.
 * RFC-001 Task 013-agent-role-contracts, Rev 06 Section 3.2.
 */

import type { AgentRole } from "../interfaces/agent-role.js";
import { AgentParseError } from "./agent-parse-error.js";

const TOOLS: readonly string[] = ["fs_read", "git_diff", "git_log"];

export class PlannerAgent implements AgentRole<string> {
  readonly name = "planner";
  readonly systemPrompt =
    "You are the Lead Architect. You produce a TechnicalSpec (Markdown) that defines the contract for implementation. Read-Only access.";
  readonly allowedTools = TOOLS;

  parse(response: string): string {
    const trimmed = response.trim();
    if (trimmed.length === 0) {
      throw new AgentParseError("Empty response", response);
    }
    return trimmed;
  }
}
