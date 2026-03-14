import { ConversationImpl } from '../core/conversation.js'
import { UserMessage } from '../interfaces/agentic-message.js'

const msg = (content: string): UserMessage => ({
  role: 'user' as const,
  content,
  timestamp: Date.now(),
})

describe('ConversationImpl', () => {
  it('empty state: messages is [], length is 0, tokenEstimate is 0', () => {
    const conv = ConversationImpl.create('sys')
    expect(conv.messages).toEqual([])
    expect(conv.length).toBe(0)
    expect(conv.tokenEstimate).toBe(0)
  })

  it('system message preservation', () => {
    const conv = ConversationImpl.create('You are helpful.')
    expect(conv.systemMessage).toBe('You are helpful.')
  })

  it('immutability: append does not mutate the original', () => {
    const conv1 = ConversationImpl.create('sys')
    const conv2 = conv1.append(msg('hello'))

    expect(conv1.length).toBe(0)
    expect(conv1.messages).toEqual([])
    expect(conv2.length).toBe(1)
    expect(conv2.messages).toHaveLength(1)
  })

  it('structural sharing: original unchanged after append', () => {
    const conv1 = ConversationImpl.create('sys').append(msg('a')).append(msg('b'))
    const conv2 = conv1.append(msg('c'))

    expect(conv1.length).toBe(2)
    expect(conv2.length).toBe(3)
    expect(conv1.messages.map((m) => m.content)).toEqual(['a', 'b'])
    expect(conv2.messages.map((m) => m.content)).toEqual(['a', 'b', 'c'])
  })

  it('message ordering: chronological (oldest first)', () => {
    const conv = ConversationImpl.create('sys')
      .append(msg('first'))
      .append(msg('second'))
      .append(msg('third'))

    const contents = conv.messages.map((m) => m.content)
    expect(contents).toEqual(['first', 'second', 'third'])
  })

  it('frozen output: Object.isFrozen(conv.messages) is true', () => {
    const conv = ConversationImpl.create('sys').append(msg('a'))
    expect(Object.isFrozen(conv.messages)).toBe(true)
  })

  it('frozen output: empty messages array is also frozen', () => {
    const conv = ConversationImpl.create('sys')
    expect(Object.isFrozen(conv.messages)).toBe(true)
  })

  it('token estimation: 400-char message increases by ~100', () => {
    const conv = ConversationImpl.create('sys').append(msg('x'.repeat(400)))
    expect(conv.tokenEstimate).toBe(100)
  })

  it('token estimation: accumulates across appends', () => {
    const conv = ConversationImpl.create('sys')
      .append(msg('x'.repeat(400)))
      .append(msg('x'.repeat(200)))

    expect(conv.tokenEstimate).toBe(150)
  })

  it('token estimation: non-divisible-by-4 length rounds up', () => {
    const conv = ConversationImpl.create('sys').append(msg('x'.repeat(5)))
    expect(conv.tokenEstimate).toBe(2)
  })

  it('chain of 100 appends: all 100 present in order', () => {
    let conv = ConversationImpl.create('sys')
    for (let i = 0; i < 100; i++) {
      conv = conv.append(msg(`msg-${i}`))
    }

    expect(conv.length).toBe(100)
    const messages = conv.messages
    expect(messages).toHaveLength(100)
    for (let i = 0; i < 100; i++) {
      expect(messages[i].content).toBe(`msg-${i}`)
    }
  })
})
