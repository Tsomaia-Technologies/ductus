import { ConversationImpl } from '../core/conversation.js'
import { ReplaceContextPolicy } from '../core/context-policies/replace-context-policy.js'
import { TruncateContextPolicy } from '../core/context-policies/truncate-context-policy.js'
import { SlidingWindowContextPolicy } from '../core/context-policies/sliding-window-context-policy.js'
import { SummarizeContextPolicy } from '../core/context-policies/summarize-context-policy.js'
import { UserMessage } from '../interfaces/agentic-message.js'
import { AgentTransport } from '../interfaces/agent-transport.js'
import { CommittedEvent } from '../interfaces/event.js'
import { ContextPolicyContext } from '../interfaces/context-policy.js'
import { TemplateRenderer } from '../interfaces/template-renderer.js'

const userMsg = (content: string): UserMessage => ({
  role: 'user' as const,
  content,
  timestamp: Date.now(),
})

const dummyTransport: AgentTransport = {
  async *send() {
    yield { type: 'complete' as const, timestamp: Date.now() }
  },
  async close() {},
}

function buildConversation(system: string, messages: string[]) {
  let conv = ConversationImpl.create(system)
  for (const msg of messages) {
    conv = conv.append(userMsg(msg))
  }
  return conv
}

function makeEvent(seq: number, type = 'TestEvent', payload: unknown = {}): CommittedEvent {
  return {
    type,
    payload,
    volatility: 'durable',
    isCommited: true,
    eventId: `evt-${seq}`,
    sequenceNumber: seq,
    prevHash: 'prev',
    hash: `hash-${seq}`,
    timestamp: 1000 + seq,
  } as CommittedEvent
}

async function* eventsIterable(events: CommittedEvent[]): AsyncIterable<CommittedEvent> {
  for (const e of events) yield e
}

async function* emptyEvents(): AsyncIterable<CommittedEvent> {}

const noopRenderer: TemplateRenderer = (t) => t

function makeContext(events: CommittedEvent[], state: unknown = {}, renderer?: TemplateRenderer): ContextPolicyContext {
  return {
    events: eventsIterable(events),
    state,
    templateRenderer: renderer ?? noopRenderer,
  }
}

describe('ReplaceContextPolicy', () => {
  it('returns conversation with 0 messages and same system message', async () => {
    const conv = buildConversation('You are helpful.', ['hello', 'world'])
    const policy = new ReplaceContextPolicy()
    const result = await policy.apply(conv, 1000, dummyTransport)

    expect(result.messages).toHaveLength(0)
    expect(result.length).toBe(0)
    expect(result.systemMessage).toBe('You are helpful.')
  })
})

describe('TruncateContextPolicy', () => {
  it('removes oldest messages when over token limit', async () => {
    const messages = Array.from({ length: 20 }, (_, i) => 'x'.repeat(100))
    const conv = buildConversation('sys', messages)
    expect(conv.tokenEstimate).toBe(500)

    const policy = new TruncateContextPolicy()
    const result = await policy.apply(conv, 100, dummyTransport)

    expect(result.tokenEstimate).toBeLessThanOrEqual(100)
    expect(result.length).toBeLessThan(20)
    expect(result.length).toBeGreaterThan(0)
    expect(result.systemMessage).toBe('sys')
  })

  it('preserves at least preserveLastN messages even if over limit', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => 'x'.repeat(100))
    const conv = buildConversation('sys', messages)

    const policy = new TruncateContextPolicy({ preserveLastN: 5 })
    const result = await policy.apply(conv, 50, dummyTransport)

    expect(result.length).toBeGreaterThanOrEqual(5)
    const resultContents = result.messages.map((m) => m.content)
    const originalContents = conv.messages.map((m) => m.content)
    expect(resultContents).toEqual(originalContents.slice(-result.length))
  })

  it('preserves chronological order', async () => {
    const conv = buildConversation(
      'sys',
      ['first', 'second', 'third', 'fourth', 'fifth'],
    )
    const policy = new TruncateContextPolicy()
    const result = await policy.apply(conv, 1000, dummyTransport)

    const contents = result.messages.map((m) => m.content)
    expect(contents).toEqual(['first', 'second', 'third', 'fourth', 'fifth'])
  })
})

describe('SlidingWindowContextPolicy', () => {
  it('always keeps messages within the window token budget', async () => {
    const messages = Array.from({ length: 20 }, () => 'x'.repeat(100))
    const conv = buildConversation('sys', messages)

    const policy = new SlidingWindowContextPolicy({ windowTokens: 100 })
    const result = await policy.apply(conv, 99999, dummyTransport)

    expect(result.tokenEstimate).toBeLessThanOrEqual(100)
    expect(result.length).toBeGreaterThan(0)
    expect(result.systemMessage).toBe('sys')
  })

  it('respects the limit parameter when it is smaller than windowTokens', async () => {
    const messages = Array.from({ length: 10 }, () => 'x'.repeat(100))
    const conv = buildConversation('sys', messages)

    const policy = new SlidingWindowContextPolicy({ windowTokens: 9999 })
    const resultSmallLimit = await policy.apply(conv, 50, dummyTransport)
    const resultBigLimit = await policy.apply(conv, 100000, dummyTransport)

    expect(resultSmallLimit.length).toBeLessThan(resultBigLimit.length)
    expect(resultSmallLimit.tokenEstimate).toBeLessThanOrEqual(50)
  })

  it('uses windowTokens when it is smaller than limit', async () => {
    const messages = Array.from({ length: 10 }, () => 'x'.repeat(100))
    const conv = buildConversation('sys', messages)

    const policy = new SlidingWindowContextPolicy({ windowTokens: 75 })
    const result = await policy.apply(conv, 100000, dummyTransport)

    expect(result.tokenEstimate).toBeLessThanOrEqual(75)
  })
})

describe('SummarizeContextPolicy', () => {
  it('builds event-based summary with preserved messages', async () => {
    const events = [makeEvent(1, 'OrderPlaced', { id: 1 }), makeEvent(2, 'OrderShipped', { id: 1 })]
    const conv = buildConversation('sys', ['msg1', 'msg2', 'msg3', 'msg4'])
    const policy = new SummarizeContextPolicy({ preserveLastN: 2 })
    const ctx = makeContext(events, { count: 42 })
    const result = await policy.apply(conv, 1000, dummyTransport, undefined, ctx)

    expect(result.systemMessage).toBe('sys')
    expect(result.messages[0].role).toBe('assistant')
    expect(result.messages[0].content).toContain('Context summary:')
    expect(result.messages[0].content).toContain('OrderPlaced')
    expect(result.messages[0].content).toContain('OrderShipped')
    expect(result.length).toBe(3)
    expect(result.messages[1].content).toBe('msg3')
    expect(result.messages[2].content).toBe('msg4')
  })

  it('works with preserveLastN = 0 and events', async () => {
    const events = [makeEvent(1), makeEvent(2)]
    const conv = buildConversation('sys', ['a', 'b', 'c'])
    const policy = new SummarizeContextPolicy()
    const ctx = makeContext(events)
    const result = await policy.apply(conv, 500, dummyTransport, undefined, ctx)

    expect(result.length).toBe(1)
    expect(result.messages[0].role).toBe('assistant')
    expect(result.messages[0].content).toContain('Total events: 2')
  })

  it('returns empty conversation immediately when input has no messages', async () => {
    const conv = ConversationImpl.create('sys')
    const policy = new SummarizeContextPolicy()
    const result = await policy.apply(conv, 1000, dummyTransport)

    expect(result.length).toBe(0)
    expect(result.systemMessage).toBe('sys')
  })

  it('falls back to truncation when no events are provided (no context)', async () => {
    const conv = buildConversation('sys', ['a', 'b', 'c', 'd', 'e'])
    const policy = new SummarizeContextPolicy({ preserveLastN: 2 })
    const result = await policy.apply(conv, 1000, dummyTransport)

    expect(result.systemMessage).toBe('sys')
    expect(result.length).toBeGreaterThanOrEqual(2)
    const contents = result.messages.map((m) => m.content)
    expect(contents).toContain('d')
    expect(contents).toContain('e')
  })

  it('falls back to truncation when events iterable is empty', async () => {
    const conv = buildConversation('sys', ['a', 'b', 'c'])
    const policy = new SummarizeContextPolicy({ preserveLastN: 1 })
    const ctx: ContextPolicyContext = {
      events: emptyEvents(),
      state: {},
      templateRenderer: noopRenderer,
    }
    const result = await policy.apply(conv, 1000, dummyTransport, undefined, ctx)

    expect(result.systemMessage).toBe('sys')
    expect(result.length).toBeGreaterThanOrEqual(1)
    const contents = result.messages.map((m) => m.content)
    expect(contents).toContain('c')
  })

  it('includes event types and counts in structured summary', async () => {
    const events = [
      makeEvent(1, 'UserCreated'),
      makeEvent(2, 'UserCreated'),
      makeEvent(3, 'OrderPlaced'),
    ]
    const conv = buildConversation('sys', ['hello'])
    const policy = new SummarizeContextPolicy()
    const ctx = makeContext(events)
    const result = await policy.apply(conv, 1000, dummyTransport, undefined, ctx)

    const summary = result.messages[0].content
    expect(summary).toContain('Total events: 3')
    expect(summary).toContain('UserCreated: 2')
    expect(summary).toContain('OrderPlaced: 1')
  })

  it('includes state in structured summary', async () => {
    const events = [makeEvent(1)]
    const conv = buildConversation('sys', ['hello'])
    const policy = new SummarizeContextPolicy()
    const ctx = makeContext(events, { userCount: 5 })
    const result = await policy.apply(conv, 1000, dummyTransport, undefined, ctx)

    expect(result.messages[0].content).toContain('"userCount":5')
  })

  it('includes recent events with sequence numbers', async () => {
    const events = Array.from({ length: 8 }, (_, i) => makeEvent(i + 1, 'Evt'))
    const conv = buildConversation('sys', ['hello'])
    const policy = new SummarizeContextPolicy()
    const ctx = makeContext(events)
    const result = await policy.apply(conv, 1000, dummyTransport, undefined, ctx)

    const summary = result.messages[0].content
    expect(summary).toContain('Recent events:')
    expect(summary).toContain('[8] Evt')
  })

  it('renders summaryTemplate via templateRenderer when provided', async () => {
    const events = [makeEvent(1, 'TaskDone', { result: 'ok' })]
    let capturedCtx: Record<string, unknown> = {}
    const renderer: TemplateRenderer = (_t, ctx) => {
      capturedCtx = ctx
      return `Rendered: ${ctx.eventCount} events`
    }
    const conv = buildConversation('sys', ['hello'])
    const policy = new SummarizeContextPolicy({ summaryTemplate: 'my-template' })
    const ctx = makeContext(events, { x: 1 }, renderer)
    const result = await policy.apply(conv, 1000, dummyTransport, undefined, ctx)

    expect(result.messages[0].content).toBe('Rendered: 1 events')
    expect(capturedCtx.eventCount).toBe(1)
    expect(capturedCtx.state).toEqual({ x: 1 })
    expect((capturedCtx.eventTypes as string[])).toEqual(['TaskDone'])
  })

  it('preserveLastN with events produces summary + preserved messages', async () => {
    const events = [makeEvent(1), makeEvent(2)]
    const conv = buildConversation('sys', ['a', 'b', 'c', 'd'])
    const policy = new SummarizeContextPolicy({ preserveLastN: 3 })
    const ctx = makeContext(events)
    const result = await policy.apply(conv, 1000, dummyTransport, undefined, ctx)

    expect(result.messages[0].role).toBe('assistant')
    expect(result.messages[0].content).toContain('Context summary:')
    expect(result.length).toBe(4)
    expect(result.messages[1].content).toBe('b')
    expect(result.messages[2].content).toBe('c')
    expect(result.messages[3].content).toBe('d')
  })

  it('uses empty system message when preserveSystem is false', async () => {
    const events = [makeEvent(1)]
    const conv = buildConversation('You are helpful.', ['msg1', 'msg2'])
    const policy = new SummarizeContextPolicy({ preserveSystem: false })
    const ctx = makeContext(events)
    const result = await policy.apply(conv, 1000, dummyTransport, undefined, ctx)

    expect(result.systemMessage).toBe('')
    expect(result.messages[0].content).toContain('Context summary:')
  })

  it('preserves system message by default', async () => {
    const events = [makeEvent(1)]
    const conv = buildConversation('You are helpful.', ['msg1', 'msg2'])
    const policy = new SummarizeContextPolicy()
    const ctx = makeContext(events)
    const result = await policy.apply(conv, 1000, dummyTransport, undefined, ctx)

    expect(result.systemMessage).toBe('You are helpful.')
  })

  it('uses empty system message in fallback path when preserveSystem is false', async () => {
    const conv = buildConversation('You are helpful.', ['a', 'b', 'c'])
    const policy = new SummarizeContextPolicy({ preserveSystem: false })
    const result = await policy.apply(conv, 1000, dummyTransport)

    expect(result.systemMessage).toBe('')
    expect(result.length).toBeGreaterThan(0)
  })
})
