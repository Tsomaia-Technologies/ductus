import { Conversation } from './conversation.js'
import { AgentTransport } from './agent-transport.js'

export type ContextPolicyName = 'replace' | 'truncate' | 'summarize' | 'sliding-window'

export interface ContextPolicy {
  apply(
    conversation: Conversation,
    limit: number,
    transport: AgentTransport,
    model?: string,
  ): Promise<Conversation>
}
