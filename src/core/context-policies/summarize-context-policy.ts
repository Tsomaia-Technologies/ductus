import { ContextPolicy } from '../../interfaces/context-policy.js'
import { Conversation } from '../../interfaces/conversation.js'
import { AgentTransport, TransportRequest } from '../../interfaces/agent-transport.js'
import { AssistantMessage } from '../../interfaces/agentic-message.js'
import { ConversationImpl } from '../conversation.js'
import { selectFromEnd } from './truncate-context-policy.js'

export interface SummarizeOptions {
  targetTokens?: number
  preserveLastN?: number
}

export class SummarizeContextPolicy implements ContextPolicy {
  private readonly targetTokens: number | undefined
  private readonly preserveLastN: number

  constructor(options: SummarizeOptions = {}) {
    this.targetTokens = options.targetTokens
    this.preserveLastN = options.preserveLastN ?? 0
  }

  async apply(
    conversation: Conversation,
    limit: number,
    transport: AgentTransport,
  ): Promise<Conversation> {
    if (conversation.length === 0) {
      return ConversationImpl.create(conversation.systemMessage)
    }

    const effectiveTargetTokens = this.targetTokens ?? Math.floor(limit / 2)

    const summarizeConv = conversation.append({
      role: 'user',
      content:
        `Summarize the conversation so far concisely, preserving key decisions, context, and outputs. Target approximately ${effectiveTargetTokens} tokens.`,
      timestamp: Date.now(),
    })

    const request: TransportRequest = {
      conversation: summarizeConv,
      newFromIndex: conversation.length,
      model: 'default',
      temperature: 0,
    }

    let summary: string
    try {
      summary = ''
      for await (const chunk of transport.send(request)) {
        if (chunk.type === 'text') summary += chunk.content
      }
    } catch {
      const retained = selectFromEnd(conversation.messages, limit, this.preserveLastN)
      let fallback: Conversation = ConversationImpl.create(conversation.systemMessage)
      for (const msg of retained) {
        fallback = fallback.append(msg)
      }
      return fallback
    }

    const summaryMessage: AssistantMessage = {
      role: 'assistant',
      content: summary,
      agentId: 'context-policy',
      timestamp: Date.now(),
    }

    let result: Conversation = ConversationImpl.create(conversation.systemMessage)
    result = result.append(summaryMessage)

    const messages = conversation.messages
    const preserved = messages.slice(Math.max(0, messages.length - this.preserveLastN))
    for (const msg of preserved) {
      result = result.append(msg)
    }

    return result
  }
}
