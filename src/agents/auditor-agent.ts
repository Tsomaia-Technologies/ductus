/**
 * AuditorAgent - Feature Reviewer.
 * Compares finalized Codebase Type against original SPEC.md. Read-Only.
 * RFC-001 Task 018, Rev 06 Section 8.2.
 */

import { z } from "zod";
import type { AgentRole } from "../interfaces/agent-role.js";
import { AgentParseError } from "./agent-parse-error.js";

const TOOLS: readonly string[] = ["fs_read", "git_diff", "git_log"];

const AuditorReportSchema = z.object({
  approved: z.boolean(),
  critique: z.string().optional(),
});

export type AuditorReportOutput = z.infer<typeof AuditorReportSchema>;

const JSON_BLOCK_RE = /```(?:json)?\s*([\s\S]*?)```/;

function extractJsonBlock(raw: string): string {
  const m = raw.match(JSON_BLOCK_RE);
  if (m) return m[1]!.trim();
  return raw.trim();
}

export class AuditorAgent implements AgentRole<AuditorReportOutput> {
  readonly name = "auditor";
  readonly systemPrompt =
    "You are the Feature Reviewer. Compare the implemented codebase against the original SPEC.md. Return JSON: { approved: boolean, critique?: string }. Set approved=false and provide critique when gaps exist.";
  readonly allowedTools = TOOLS;

  parse(response: string): AuditorReportOutput {
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
    const result = AuditorReportSchema.safeParse(parsed);
    if (result.success) return result.data;
    throw new AgentParseError(
      result.error.issues[0]?.message ?? "Invalid auditor report",
      response
    );
  }
}
