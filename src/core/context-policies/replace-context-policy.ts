import { ContextPolicy } from '../../interfaces/context-policy.js'
import { Conversation } from '../../interfaces/conversation.js'
import { AgentTransport } from '../../interfaces/agent-transport.js'
import { ConversationImpl } from '../conversation.js'

/**
 * Clears all messages and returns a fresh conversation with only the system message.
 *
 * In the V1 adapter model, context replacement terminated the adapter and created
 * a new one with handoff context. In V2 (transport-based), there is no adapter to
 * terminate — the policy simply resets the conversation. Handoff context, if needed,
 * is handled separately by the dispatcher's lifecycle management.
 */
export class ReplaceContextPolicy implements ContextPolicy {
  async apply(
    conversation: Conversation,
    _limit: number,
    _transport: AgentTransport,
    _model?: string,
  ): Promise<Conversation> {
    return ConversationImpl.create(conversation.systemMessage)
  }
}
