import { ContextPolicy } from '../../interfaces/context-policy.js'
import { Conversation } from '../../interfaces/conversation.js'
import { AgentTransport } from '../../interfaces/agent-transport.js'
import { ConversationImpl } from '../conversation.js'

export class ReplaceContextPolicy implements ContextPolicy {
  async apply(
    conversation: Conversation,
    _limit: number,
    _transport: AgentTransport,
  ): Promise<Conversation> {
    return ConversationImpl.create(conversation.systemMessage)
  }
}
