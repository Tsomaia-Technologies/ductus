/**
 * EngineerAgent - Read/Write/Exec Foreman.
 * Output: Execution report with files array. Stateless, no I/O.
 * RFC-001 Task 013-agent-role-contracts, Rev 06 Section 3.2.
 */

import { z } from "zod";
import type { AgentRole } from "../interfaces/agent-role.js";
import { AgentParseError } from "./agent-parse-error.js";

const TOOLS: readonly string[] = [
  "fs_read",
  "fs_write",
  "git_diff",
  "git_apply",
  "run_tool",
];

const EngineerReportSchema = z.object({
  files: z.array(z.string()),
});

export type EngineerReportOutput = z.infer<typeof EngineerReportSchema>;

const JSON_BLOCK_RE = /```(?:json)?\s*([\s\S]*?)```/;

/** Strips markdown code fence wrapping to extract JSON. */
function extractJsonBlock(raw: string): string {
  const m = raw.match(JSON_BLOCK_RE);
  if (m) return m[1]!.trim();
  return raw.trim();
}

export class EngineerAgent implements AgentRole<EngineerReportOutput> {
  readonly name = "engineer";
  readonly systemPrompt =
    "You are the Engineer Agent. You operate with Read/Write/Exec access. Return a JSON object with a 'files' array listing modified file paths.";
  readonly allowedTools = TOOLS;

  parse(response: string): EngineerReportOutput {
    const extracted = extractJsonBlock(response);
    if (!extracted) {
      throw new AgentParseError("No JSON content found", response);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(extracted);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new AgentParseError(`JSON parse failed: ${msg}`, response);
    }
    const result = EngineerReportSchema.safeParse(parsed);
    if (result.success) return result.data;
    throw new AgentParseError(
      result.error.issues[0]?.message ?? "Invalid engineer report",
      response
    );
  }
}
