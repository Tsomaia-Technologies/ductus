import { ConversationImpl } from '../core/conversation.js'
import { ReplaceContextPolicy } from '../core/context-policies/replace-context-policy.js'
import { TruncateContextPolicy } from '../core/context-policies/truncate-context-policy.js'
import { SlidingWindowContextPolicy } from '../core/context-policies/sliding-window-context-policy.js'
import { SummarizeContextPolicy } from '../core/context-policies/summarize-context-policy.js'
import { UserMessage } from '../interfaces/agentic-message.js'
import { AgentTransport } from '../interfaces/agent-transport.js'

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

  it('ignores the limit parameter and uses windowTokens instead', async () => {
    const messages = Array.from({ length: 10 }, () => 'x'.repeat(100))
    const conv = buildConversation('sys', messages)

    const policy = new SlidingWindowContextPolicy({ windowTokens: 75 })
    const resultSmallLimit = await policy.apply(conv, 10, dummyTransport)
    const resultBigLimit = await policy.apply(conv, 100000, dummyTransport)

    expect(resultSmallLimit.length).toBe(resultBigLimit.length)
  })
})

describe('SummarizeContextPolicy', () => {
  it('calls transport.send() and builds summary + preserved messages', async () => {
    const mockTransport: AgentTransport = {
      async *send() {
        yield { type: 'text' as const, content: 'Summary of conversation', timestamp: Date.now() }
        yield { type: 'complete' as const, timestamp: Date.now() }
      },
      async close() {},
    }

    const conv = buildConversation('sys', ['msg1', 'msg2', 'msg3', 'msg4'])
    const policy = new SummarizeContextPolicy({ preserveLastN: 2 })
    const result = await policy.apply(conv, 1000, mockTransport)

    expect(result.systemMessage).toBe('sys')
    expect(result.messages[0].role).toBe('assistant')
    expect(result.messages[0].content).toBe('Summary of conversation')
    expect(result.length).toBe(3)
    expect(result.messages[1].content).toBe('msg3')
    expect(result.messages[2].content).toBe('msg4')
  })

  it('works with preserveLastN = 0', async () => {
    const mockTransport: AgentTransport = {
      async *send() {
        yield { type: 'text' as const, content: 'A summary', timestamp: Date.now() }
        yield { type: 'complete' as const, timestamp: Date.now() }
      },
      async close() {},
    }

    const conv = buildConversation('sys', ['a', 'b', 'c'])
    const policy = new SummarizeContextPolicy()
    const result = await policy.apply(conv, 500, mockTransport)

    expect(result.length).toBe(1)
    expect(result.messages[0].role).toBe('assistant')
    expect(result.messages[0].content).toBe('A summary')
  })

  it('returns empty conversation immediately when input has no messages', async () => {
    const failTransport: AgentTransport = {
      async *send() {
        throw new Error('should not be called')
      },
      async close() {},
    }

    const conv = ConversationImpl.create('sys')
    const policy = new SummarizeContextPolicy()
    const result = await policy.apply(conv, 1000, failTransport)

    expect(result.length).toBe(0)
    expect(result.systemMessage).toBe('sys')
  })

  it('falls back to truncation when transport throws', async () => {
    const errorTransport: AgentTransport = {
      async *send() {
        throw new Error('transport failure')
      },
      async close() {},
    }

    const conv = buildConversation('sys', ['a', 'b', 'c', 'd', 'e'])
    const policy = new SummarizeContextPolicy({ preserveLastN: 2 })
    const result = await policy.apply(conv, 1000, errorTransport)

    expect(result.systemMessage).toBe('sys')
    expect(result.length).toBeGreaterThanOrEqual(2)
    const contents = result.messages.map((m) => m.content)
    expect(contents).toContain('d')
    expect(contents).toContain('e')
  })

  it('includes targetTokens in the prompt sent to transport', async () => {
    let capturedPrompt = ''
    const capturingTransport: AgentTransport = {
      async *send(request) {
        const msgs = request.conversation.messages
        capturedPrompt = msgs[msgs.length - 1].content
        yield { type: 'text' as const, content: 'Summary', timestamp: Date.now() }
        yield { type: 'complete' as const, timestamp: Date.now() }
      },
      async close() {},
    }

    const conv = buildConversation('sys', ['hello'])
    const policy = new SummarizeContextPolicy({ targetTokens: 200 })
    await policy.apply(conv, 1000, capturingTransport)

    expect(capturedPrompt).toContain('200 tokens')
  })

  it('defaults targetTokens to half the limit when not provided', async () => {
    let capturedPrompt = ''
    const capturingTransport: AgentTransport = {
      async *send(request) {
        const msgs = request.conversation.messages
        capturedPrompt = msgs[msgs.length - 1].content
        yield { type: 'text' as const, content: 'Summary', timestamp: Date.now() }
        yield { type: 'complete' as const, timestamp: Date.now() }
      },
      async close() {},
    }

    const conv = buildConversation('sys', ['hello'])
    const policy = new SummarizeContextPolicy()
    await policy.apply(conv, 800, capturingTransport)

    expect(capturedPrompt).toContain('400 tokens')
  })
})
