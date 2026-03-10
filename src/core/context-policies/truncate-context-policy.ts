import { ContextPolicy } from '../../interfaces/context-policy.js'
import { Conversation } from '../../interfaces/conversation.js'
import { AgentTransport } from '../../interfaces/agent-transport.js'
import { AgenticMessage } from '../../interfaces/agentic-message.js'
import { ConversationImpl } from '../conversation.js'

export interface TruncateOptions {
  preserveLastN?: number
}

export class TruncateContextPolicy implements ContextPolicy {
  private readonly preserveLastN: number

  constructor(options: TruncateOptions = {}) {
    this.preserveLastN = options.preserveLastN ?? 0
  }

  async apply(
    conversation: Conversation,
    limit: number,
    _transport: AgentTransport,
  ): Promise<Conversation> {
    const messages = conversation.messages
    const retained = selectFromEnd(messages, limit, this.preserveLastN)

    let result: Conversation = ConversationImpl.create(conversation.systemMessage)
    for (const msg of retained) {
      result = result.append(msg)
    }
    return result
  }
}

export function selectFromEnd(
  messages: readonly AgenticMessage[],
  tokenLimit: number,
  preserveLastN: number,
): AgenticMessage[] {
  let tokens = 0
  let cutoff = messages.length

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = Math.ceil(messages[i].content.length / 4)
    if (tokens + msgTokens > tokenLimit && messages.length - i > preserveLastN) {
      break
    }
    tokens += msgTokens
    cutoff = i
  }

  const minStart = Math.max(0, messages.length - preserveLastN)
  if (cutoff > minStart) cutoff = minStart

  return messages.slice(cutoff) as AgenticMessage[]
}
