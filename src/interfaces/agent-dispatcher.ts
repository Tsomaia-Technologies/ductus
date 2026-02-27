import type { AgentContext } from "./agent-context.js";
import type { AgentRole } from "./agent-role.js";
import type { OutputEventStream } from "./output-event-stream.js";

export interface AgentDispatcher {
  process(
    input: string,
    role: AgentRole<unknown>,
    context?: AgentContext
  ): Promise<OutputEventStream>;

  terminate(role: AgentRole<unknown>): void;
}
