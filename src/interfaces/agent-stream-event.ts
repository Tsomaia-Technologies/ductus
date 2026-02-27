/**
 * AgentStreamEvent - yield type from AgentDispatcher to AgentProcessor.
 * Internal contract, not Hub events. RFC-001 Task 014-agent-dispatcher.
 */

export type AgentStreamEvent<TOutput = unknown> =
  | { type: "token"; content: string }
  | { type: "complete"; parsedOutput: TOutput }
  | { type: "failure"; error: string };
