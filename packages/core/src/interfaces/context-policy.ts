import { Conversation } from './conversation.js'
import { AgentTransport } from './agent-transport.js'
import { CommittedEvent } from './event.js'
import { TemplateRenderer } from './template-renderer.js'

export type ContextPolicyName = 'replace' | 'truncate' | 'summarize' | 'sliding-window'

export interface ContextPolicyContext {
  events: AsyncIterable<CommittedEvent>
  state: unknown
  templateRenderer: TemplateRenderer
}

export interface ContextPolicy {
  apply(
    conversation: Conversation,
    limit: number,
    transport: AgentTransport,
    model?: string,
    context?: ContextPolicyContext,
  ): Promise<Conversation>
}
