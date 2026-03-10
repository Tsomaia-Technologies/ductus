import { ContextPolicy } from '../../interfaces/context-policy.js'
import { Conversation } from '../../interfaces/conversation.js'
import { AgentTransport } from '../../interfaces/agent-transport.js'
import { ConversationImpl } from '../conversation.js'
import { selectFromEnd } from './truncate-context-policy.js'

export interface SlidingWindowOptions {
  windowTokens: number
}

export class SlidingWindowContextPolicy implements ContextPolicy {
  private readonly windowTokens: number

  constructor(options: SlidingWindowOptions) {
    this.windowTokens = options.windowTokens
  }

  async apply(
    conversation: Conversation,
    _limit: number,
    _transport: AgentTransport,
  ): Promise<Conversation> {
    const messages = conversation.messages
    const retained = selectFromEnd(messages, this.windowTokens, 0)

    let result: Conversation = ConversationImpl.create(conversation.systemMessage)
    for (const msg of retained) {
      result = result.append(msg)
    }
    return result
  }
}
