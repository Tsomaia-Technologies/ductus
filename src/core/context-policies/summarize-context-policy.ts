import { ContextPolicy, ContextPolicyContext } from '../../interfaces/context-policy.js'
import { Conversation } from '../../interfaces/conversation.js'
import { AgentTransport } from '../../interfaces/agent-transport.js'
import { AssistantMessage } from '../../interfaces/agentic-message.js'
import { CommittedEvent } from '../../interfaces/event.js'
import { ConversationImpl } from '../conversation.js'
import { selectFromEnd } from './truncate-context-policy.js'

export interface SummarizeOptions {
  targetTokens?: number
  preserveLastN?: number
  preserveSystem?: boolean
  summaryTemplate?: string
}

export class SummarizeContextPolicy implements ContextPolicy {
  private readonly targetTokens: number | undefined
  private readonly preserveLastN: number
  private readonly preserveSystem: boolean
  private readonly summaryTemplate: string | undefined

  constructor(options: SummarizeOptions = {}) {
    this.targetTokens = options.targetTokens
    this.preserveLastN = options.preserveLastN ?? 0
    this.preserveSystem = options.preserveSystem ?? true
    this.summaryTemplate = options.summaryTemplate
  }

  async apply(
    conversation: Conversation,
    limit: number,
    _transport: AgentTransport,
    _model?: string,
    context?: ContextPolicyContext,
  ): Promise<Conversation> {
    const systemMessage = this.preserveSystem ? conversation.systemMessage : ''

    if (conversation.length === 0) {
      return ConversationImpl.create(systemMessage)
    }

    const events = context ? await collectEvents(context.events) : []

    if (events.length === 0) {
      const retained = selectFromEnd(conversation.messages, limit, this.preserveLastN)
      let fallback: Conversation = ConversationImpl.create(systemMessage)
      for (const msg of retained) {
        fallback = fallback.append(msg)
      }
      return fallback
    }

    let summaryText: string

    if (this.summaryTemplate && context?.templateRenderer) {
      summaryText = await context.templateRenderer(this.summaryTemplate, {
        events: events.map(formatEventForTemplate),
        state: context.state,
        eventCount: events.length,
        eventTypes: [...new Set(events.map(e => e.type))],
      })
    } else {
      summaryText = buildStructuredSummary(events, context?.state, this.targetTokens)
    }

    const summaryMessage: AssistantMessage = {
      role: 'assistant',
      content: summaryText,
      agentId: 'context-policy',
      timestamp: Date.now(),
    }

    let result: Conversation = ConversationImpl.create(systemMessage)
    result = result.append(summaryMessage)

    if (this.preserveLastN > 0) {
      const messages = conversation.messages
      const preserved = messages.slice(Math.max(0, messages.length - this.preserveLastN))
      for (const msg of preserved) {
        result = result.append(msg)
      }
    }

    return result
  }
}

async function collectEvents(source: AsyncIterable<CommittedEvent>): Promise<CommittedEvent[]> {
  const collected: CommittedEvent[] = []
  for await (const event of source) {
    collected.push(event)
  }
  return collected
}

function formatEventForTemplate(event: CommittedEvent): Record<string, unknown> {
  return {
    type: event.type,
    payload: event.payload,
    sequence: event.sequenceNumber,
    timestamp: event.timestamp,
    eventId: event.eventId,
  }
}

function buildStructuredSummary(
  events: CommittedEvent[],
  state: unknown,
  targetTokens?: number,
): string {
  const typeGroups = new Map<string, number>()
  for (const event of events) {
    typeGroups.set(event.type, (typeGroups.get(event.type) ?? 0) + 1)
  }

  const lines: string[] = ['Context summary:']
  lines.push(`Total events: ${events.length}`)
  lines.push('')
  lines.push('Event types:')
  for (const [type, count] of typeGroups) {
    lines.push(`- ${type}: ${count}`)
  }

  if (state !== undefined && state !== null) {
    lines.push('')
    lines.push(`Current state: ${JSON.stringify(state)}`)
  }

  const maxRecent = targetTokens !== undefined ? Math.min(3, events.length) : Math.min(5, events.length)
  if (maxRecent > 0) {
    lines.push('')
    lines.push('Recent events:')
    const recent = events.slice(-maxRecent)
    for (const event of recent) {
      const payloadStr = event.payload !== undefined && event.payload !== null
        ? ` ${JSON.stringify(event.payload)}`
        : ''
      lines.push(`- [${event.sequenceNumber}] ${event.type}${payloadStr}`)
    }
  }

  return lines.join('\n')
}
