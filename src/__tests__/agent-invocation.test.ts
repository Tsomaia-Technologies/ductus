import { z } from 'zod/v3'
import { invokeAgent, InvocationOptions } from '../core/agent-invocation.js'
import { ConversationImpl } from '../core/conversation.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { AgentTransport } from '../interfaces/agent-transport.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { ToolEntity } from '../interfaces/entities/tool-entity.js'
import { Injector } from '../interfaces/event-generator.js'
import { AssistantMessage, ToolMessage } from '../interfaces/agentic-message.js'

function mockTransport(responses: AgentChunk[][]): AgentTransport {
  let callIndex = 0
  return {
    async *send() {
      const chunks = responses[callIndex++] ?? []
      for (const chunk of chunks) yield chunk
    },
    async close() {},
  }
}

const mockModel: ModelEntity = { model: 'test-model', temperature: null }

const mockUse = (() => {
  throw new Error('not implemented')
}) as unknown as Injector

function mockAgent(overrides?: Partial<AgentEntity>): AgentEntity {
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

function mockSkill(overrides?: Partial<SkillEntity>): SkillEntity {
  return {
    name: 'test-skill',
    input: { schema: z.object({ query: z.string() }) },
    output: z.object({ answer: z.string() }),
    ...overrides,
  }
}

function makeOptions(overrides?: Partial<InvocationOptions>): InvocationOptions {
  return {
    agent: mockAgent(),
    skill: mockSkill(),
    input: { query: 'test' },
    conversation: ConversationImpl.create('sys'),
    transport: mockTransport([]),
    model: mockModel,
    getState: () => ({}),
    use: mockUse,
    ...overrides,
  }
}

const text = (content: string): AgentChunk => ({ type: 'text', content, timestamp: 1 })
const complete = (): AgentChunk => ({ type: 'complete', timestamp: 1 })
const usage = (inputTokens: number, outputTokens: number): AgentChunk => ({
  type: 'usage',
  inputTokens,
  outputTokens,
  timestamp: 1,
})
const toolCall = (id: string, name: string, args: string): AgentChunk => ({
  type: 'tool-call',
  toolCall: { id, name, arguments: args },
  timestamp: 1,
})

describe('invokeAgent', () => {
  it('simple invocation with no tools and no retry', async () => {
    const transport = mockTransport([
      [text('{"answer":"hello"}'), complete()],
    ])

    const result = await invokeAgent(makeOptions({ transport }))

    expect(result.output).toEqual({ answer: 'hello' })
    expect(result.conversation.length).toBe(2)
  })

  it('tool call loop — transport yields tool-call then text on second send', async () => {
    const searchTool: ToolEntity = {
      name: 'search',
      description: 'search tool',
      inputSchema: z.object({ q: z.string() }),
      execute: async (input) => `result for ${(input as { q: string }).q}`,
    }

    const transport = mockTransport([
      [toolCall('tc1', 'search', '{"q":"hello"}')],
      [text('{"answer":"found it"}'), complete()],
    ])

    const result = await invokeAgent(
      makeOptions({
        agent: mockAgent({ tools: [searchTool] }),
        transport,
      }),
    )

    expect(result.output).toEqual({ answer: 'found it' })

    const msgs = result.conversation.messages
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
    expect((msgs[1] as AssistantMessage).toolCall?.name).toBe('search')
    expect(msgs[2].role).toBe('tool')
    expect(msgs[3].role).toBe('assistant')
  })

  it('tool not found — error tool message appended to conversation', async () => {
    const transport = mockTransport([
      [toolCall('tc1', 'missing-tool', '{}')],
      [text('{"answer":"recovered"}'), complete()],
    ])

    const result = await invokeAgent(makeOptions({ transport }))

    const toolMsg = result.conversation.messages.find(
      (m): m is ToolMessage => m.role === 'tool',
    )
    expect(toolMsg).toBeDefined()
    expect(toolMsg!.error).toBe(true)
    expect(toolMsg!.content).toContain('not found')
    expect(result.output).toEqual({ answer: 'recovered' })
  })

  it('skill assertion pass — returns successfully', async () => {
    let assertCalled = false
    const skill = mockSkill({
      assert: async (output) => {
        assertCalled = true
        z.object({ answer: z.string() }).parse(output)
      },
    })

    const transport = mockTransport([
      [text('{"answer":"valid"}'), complete()],
    ])

    const result = await invokeAgent(makeOptions({ skill, transport }))

    expect(assertCalled).toBe(true)
    expect(result.output).toEqual({ answer: 'valid' })
  })

  it('skill assertion fail + retry success', async () => {
    let assertionCount = 0
    const skill = mockSkill({
      maxRetries: 1,
      assert: async () => {
        assertionCount++
        if (assertionCount === 1) throw new Error('bad output')
      },
    })

    const transport = mockTransport([
      [text('{"answer":"wrong"}'), complete()],
      [text('{"answer":"correct"}'), complete()],
    ])

    const result = await invokeAgent(makeOptions({ skill, transport }))

    expect(assertionCount).toBe(2)
    expect(result.output).toEqual({ answer: 'correct' })
  })

  it('skill assertion exhausted — throws after maxRetries+1 attempts', async () => {
    const skill = mockSkill({
      maxRetries: 2,
      assert: async () => {
        throw new Error('always fails')
      },
    })

    const transport = mockTransport([
      [text('{"answer":"a"}'), complete()],
      [text('{"answer":"b"}'), complete()],
      [text('{"answer":"c"}'), complete()],
    ])

    await expect(
      invokeAgent(makeOptions({ skill, transport })),
    ).rejects.toThrow('always fails')
  })

  it('token usage accumulates across chunks and transport calls', async () => {
    const searchTool: ToolEntity = {
      name: 'lookup',
      description: 'lookup tool',
      inputSchema: z.object({ id: z.string() }),
      execute: async () => 'found',
    }

    const transport = mockTransport([
      [usage(100, 50), toolCall('tc1', 'lookup', '{"id":"1"}')],
      [usage(80, 30), text('{"answer":"done"}'), complete()],
    ])

    const result = await invokeAgent(
      makeOptions({
        agent: mockAgent({ tools: [searchTool] }),
        transport,
      }),
    )

    expect(result.tokenUsage).toEqual({ input: 180, output: 80 })
  })

  it('conversation growth — correct message order after tool loop', async () => {
    const echoTool: ToolEntity = {
      name: 'echo',
      description: 'echo tool',
      inputSchema: z.object({ text: z.string() }),
      execute: async (input) => (input as { text: string }).text,
    }

    const transport = mockTransport([
      [text('let me check'), toolCall('tc1', 'echo', '{"text":"ping"}')],
      [text('{"answer":"pong"}'), complete()],
    ])

    const result = await invokeAgent(
      makeOptions({
        agent: mockAgent({ tools: [echoTool] }),
        transport,
      }),
    )

    const msgs = result.conversation.messages
    expect(msgs).toHaveLength(4)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
    expect((msgs[1] as AssistantMessage).toolCall).toBeDefined()
    expect((msgs[1] as AssistantMessage).content).toBe('let me check')
    expect(msgs[2].role).toBe('tool')
    expect((msgs[2] as ToolMessage).content).toBe('ping')
    expect(msgs[3].role).toBe('assistant')
    expect((msgs[3] as AssistantMessage).toolCall).toBeUndefined()
  })
})
