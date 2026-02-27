/**
 * AgentRole - pure, stateless contract for Agent personas.
 * Defines persona, allowed tools, and output parsing. No I/O.
 * RFC-001 Task 013-agent-role-contracts, Rev 06 Section 3.1.
 */

export interface AgentRole<TOutput = unknown> {
  readonly name: string;
  readonly systemPrompt: string;
  readonly allowedTools: readonly string[];
  parse(response: string): TOutput;
}
