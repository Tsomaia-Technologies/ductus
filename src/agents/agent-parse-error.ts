/**
 * AgentParseError - thrown when AgentRole.parse() receives malformed LLM output.
 * AgentProcessor/Dispatcher uses this to increment hallucination counters and retry.
 * RFC-001 Task 013-agent-role-contracts.
 */

export class AgentParseError extends Error {
  readonly rawResponse: string;

  constructor(message: string, rawResponse: string) {
    super(message);
    this.name = "AgentParseError";
    this.rawResponse = rawResponse;
    Object.setPrototypeOf(this, AgentParseError.prototype);
  }
}
