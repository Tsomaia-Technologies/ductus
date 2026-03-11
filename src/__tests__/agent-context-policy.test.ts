import { resolveContextPolicy, enforceContextPolicy } from '../core/agent-context-policy.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { AgentLifecycleState } from '../interfaces/agent-lifecycle.js'
import { ConversationImpl } from '../core/conversation.js'
import { ReplaceContextPolicy } from '../core/context-policies/replace-context-policy.js'
import { TruncateContextPolicy } from '../core/context-policies/truncate-context-policy.js'
import { SummarizeContextPolicy } from '../core/context-policies/summarize-context-policy.js'
import { SlidingWindowContextPolicy } from '../core/context-policies/sliding-window-context-policy.js'
import { AgentTransport } from '../interfaces/agent-transport.js'

function buildAgent(overrides?: Partial<AgentEntity>): AgentEntity {
  return {
    name: 'test-agent',
    role: 'tester',
    persona: 'You are a test agent.',
    skill: [],
    rules: [],
    rulesets: [],
    ...overrides,
  } as AgentEntity
}

const dummyTransport: AgentTransport = {
  async *send() { yield { type: 'complete' as const, timestamp: Date.now() } },
  async close() {},
}

function makeLifecycleState(overrides?: Partial<AgentLifecycleState>): AgentLifecycleState {
  return {
    tokensUsed: 0,
    failures: 0,
    hallucinations: 0,
    turns: 0,
    transport: dummyTransport,
    conversation: ConversationImpl.create('sys'),
    turnRecords: [],
    currentTurnStartSequence: 0,
    ...overrides,
  }
}

describe('resolveContextPolicy', () => {
  it('returns TruncateContextPolicy by default (no policy set)', () => {
    const policy = resolveContextPolicy(buildAgent())
    expect(policy).toBeInstanceOf(TruncateContextPolicy)
  })

  it('returns ReplaceContextPolicy for "replace"', () => {
    const policy = resolveContextPolicy(buildAgent({ contextPolicy: 'replace' }))
    expect(policy).toBeInstanceOf(ReplaceContextPolicy)
  })

  it('returns TruncateContextPolicy for "truncate"', () => {
    const policy = resolveContextPolicy(buildAgent({ contextPolicy: 'truncate' }))
    expect(policy).toBeInstanceOf(TruncateContextPolicy)
  })

  it('returns SummarizeContextPolicy for "summarize"', () => {
    const policy = resolveContextPolicy(buildAgent({ contextPolicy: 'summarize' }))
    expect(policy).toBeInstanceOf(SummarizeContextPolicy)
  })

  it('returns SlidingWindowContextPolicy for "sliding-window"', () => {
    const policy = resolveContextPolicy(buildAgent({ contextPolicy: 'sliding-window', maxContextTokens: 500 }))
    expect(policy).toBeInstanceOf(SlidingWindowContextPolicy)
  })

  it('returns custom ContextPolicy object as-is', () => {
    const custom = new ReplaceContextPolicy()
    const policy = resolveContextPolicy(buildAgent({ contextPolicy: custom }))
    expect(policy).toBe(custom)
  })

  it('uses Infinity for sliding-window when maxContextTokens is undefined', () => {
    const policy = resolveContextPolicy(buildAgent({ contextPolicy: 'sliding-window' }))
    expect(policy).toBeInstanceOf(SlidingWindowContextPolicy)
  })
})

describe('enforceContextPolicy', () => {
  it('does nothing when maxContextTokens is undefined', async () => {
    const conv = ConversationImpl.create('sys')
    const state = makeLifecycleState({ conversation: conv })

    await enforceContextPolicy(buildAgent(), state)

    expect(state.conversation).toBe(conv)
  })

  it('does nothing when under token limit', async () => {
    const conv = ConversationImpl.create('sys')
    const state = makeLifecycleState({ conversation: conv })

    await enforceContextPolicy(buildAgent({ maxContextTokens: 1000 }), state)

    expect(state.conversation).toBe(conv)
  })

  it('applies replace policy when over token limit', async () => {
    let conv = ConversationImpl.create('sys')
    for (let i = 0; i < 100; i++) {
      conv = conv.append({ role: 'user', content: 'x'.repeat(100), timestamp: Date.now() })
    }

    const state = makeLifecycleState({ conversation: conv })

    await enforceContextPolicy(
      buildAgent({ maxContextTokens: 100, contextPolicy: 'replace' }),
      state,
    )

    expect(state.conversation.length).toBe(0)
    expect(state.conversation.systemMessage).toBe('sys')
  })

  it('applies truncate policy when over token limit', async () => {
    let conv = ConversationImpl.create('sys')
    for (let i = 0; i < 50; i++) {
      conv = conv.append({ role: 'user', content: 'x'.repeat(100), timestamp: Date.now() })
    }

    const state = makeLifecycleState({ conversation: conv })
    const originalLength = conv.length

    await enforceContextPolicy(
      buildAgent({ maxContextTokens: 100, contextPolicy: 'truncate' }),
      state,
    )

    expect(state.conversation.length).toBeLessThan(originalLength)
    expect(state.conversation.systemMessage).toBe('sys')
  })

  it('mutates state.conversation in place', async () => {
    let conv = ConversationImpl.create('sys')
    for (let i = 0; i < 100; i++) {
      conv = conv.append({ role: 'user', content: 'x'.repeat(100), timestamp: Date.now() })
    }

    const state = makeLifecycleState({ conversation: conv })

    await enforceContextPolicy(
      buildAgent({ maxContextTokens: 50, contextPolicy: 'replace' }),
      state,
    )

    expect(state.conversation).not.toBe(conv)
    expect(state.conversation.length).toBe(0)
  })

  it('passes model to the policy', async () => {
    let capturedModel: string | undefined
    const mockTransport: AgentTransport = {
      async *send(req) {
        capturedModel = req.model
        yield { type: 'text' as const, content: 'Summary', timestamp: Date.now() }
        yield { type: 'complete' as const, timestamp: Date.now() }
      },
      async close() {},
    }

    let conv = ConversationImpl.create('sys')
    for (let i = 0; i < 100; i++) {
      conv = conv.append({ role: 'user', content: 'x'.repeat(100), timestamp: Date.now() })
    }

    const state = makeLifecycleState({ conversation: conv, transport: mockTransport })

    await enforceContextPolicy(
      buildAgent({ maxContextTokens: 50, contextPolicy: 'summarize' }),
      state,
      'gpt-4o',
    )

    expect(capturedModel).toBe('gpt-4o')
  })
})
