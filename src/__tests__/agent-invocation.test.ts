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
import { BaseEvent, Volatility } from '../interfaces/event.js'
import { ObservationConfig } from '../interfaces/observation-config.js'
import { AssistantMessage, ToolMessage } from '../interfaces/agentic-message.js'
import {
  ToolRequested, ToolCompleted,
  SkillInvoked, SkillCompleted,
} from '../events/observation-events.js'

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

    expect(result.tokenUsage).toEqual({ input: 180, output: 80, total: 260 })
  })

  it('parallel tool calls — all tool calls in one response are executed', async () => {
    const searchTool: ToolEntity = {
      name: 'search',
      description: 'search tool',
      inputSchema: z.object({ q: z.string() }),
      execute: async (input) => `found: ${(input as { q: string }).q}`,
    }

    const calcTool: ToolEntity = {
      name: 'calc',
      description: 'calc tool',
      inputSchema: z.object({ expr: z.string() }),
      execute: async (input) => `result: ${(input as { expr: string }).expr}`,
    }

    const transport = mockTransport([
      [
        text('thinking...'),
        toolCall('tc1', 'search', '{"q":"hello"}'),
        toolCall('tc2', 'calc', '{"expr":"1+1"}'),
      ],
      [text('{"answer":"combined"}'), complete()],
    ])

    const sendSpy = jest.spyOn(transport, 'send')

    const result = await invokeAgent(
      makeOptions({
        agent: mockAgent({ tools: [searchTool, calcTool] }),
        transport,
      }),
    )

    expect(result.output).toEqual({ answer: 'combined' })

    const msgs = result.conversation.messages
    expect(msgs[0].role).toBe('user')

    const assistantMsg = msgs[1] as AssistantMessage
    expect(assistantMsg.role).toBe('assistant')
    expect(assistantMsg.content).toBe('thinking...')
    expect(assistantMsg.toolCalls).toHaveLength(2)
    expect(assistantMsg.toolCalls![0].name).toBe('search')
    expect(assistantMsg.toolCalls![1].name).toBe('calc')
    expect(assistantMsg.toolCall?.name).toBe('search')

    expect(msgs[2].role).toBe('tool')
    expect((msgs[2] as ToolMessage).toolCallId).toBe('tc1')
    expect((msgs[2] as ToolMessage).content).toBe('found: hello')

    expect(msgs[3].role).toBe('tool')
    expect((msgs[3] as ToolMessage).toolCallId).toBe('tc2')
    expect((msgs[3] as ToolMessage).content).toBe('result: 1+1')

    expect(msgs[4].role).toBe('assistant')

    const secondCallConv = sendSpy.mock.calls[1][0].conversation
    const secondCallMsgs = secondCallConv.messages
    expect(secondCallMsgs[secondCallMsgs.length - 2].role).toBe('tool')
    expect(secondCallMsgs[secondCallMsgs.length - 1].role).toBe('tool')
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

  describe('model resolution', () => {
    it('agent.defaultModel is used when options.model is omitted', async () => {
      const agentModel: ModelEntity = { model: 'agent-default', temperature: 0.5 }
      const transport = mockTransport([
        [text('{"answer":"ok"}'), complete()],
      ])
      const sendSpy = jest.spyOn(transport, 'send')

      await invokeAgent(makeOptions({
        agent: mockAgent({ defaultModel: agentModel }),
        transport,
        model: undefined,
      }))

      expect(sendSpy).toHaveBeenCalled()
      expect(sendSpy.mock.calls[0][0].model).toBe('agent-default')
      expect(sendSpy.mock.calls[0][0].temperature).toBe(0.5)
    })

    it('options.model overrides agent.defaultModel', async () => {
      const agentModel: ModelEntity = { model: 'agent-default', temperature: 0.5 }
      const optionsModel: ModelEntity = { model: 'options-override', temperature: 0.9 }
      const transport = mockTransport([
        [text('{"answer":"ok"}'), complete()],
      ])
      const sendSpy = jest.spyOn(transport, 'send')

      await invokeAgent(makeOptions({
        agent: mockAgent({ defaultModel: agentModel }),
        transport,
        model: optionsModel,
      }))

      expect(sendSpy).toHaveBeenCalled()
      expect(sendSpy.mock.calls[0][0].model).toBe('options-override')
      expect(sendSpy.mock.calls[0][0].temperature).toBe(0.9)
    })

    it('throws when no model is available', async () => {
      const transport = mockTransport([
        [text('{"answer":"ok"}'), complete()],
      ])

      await expect(
        invokeAgent(makeOptions({
          agent: mockAgent(),
          transport,
          model: undefined,
        })),
      ).rejects.toThrow(/No model configured for agent/)
    })
  })

  describe('observation events', () => {
    const observeAll: ObservationConfig = { observeAll: true, events: [], skillEvents: [] }

    it('emits AgentInvoked, SkillInvoked, SkillCompleted, AgentCompleted with observeAll', async () => {
      const events: BaseEvent[] = []
      const transport = mockTransport([
        [text('{"answer":"hello"}'), usage(10, 5), complete()],
      ])

      await invokeAgent(makeOptions({
        transport,
        onEvent: (e) => events.push(e),
        observation: observeAll,
      }))

      const types = events.map(e => e.type)
      expect(types).toContain('Ductus/AgentInvoked')
      expect(types).toContain('Ductus/SkillInvoked')
      expect(types).toContain('Ductus/SkillCompleted')
      expect(types).toContain('Ductus/AgentCompleted')

      const skillInvokedEvents = events.filter(e => e.type === 'Ductus/SkillInvoked')
      expect(skillInvokedEvents.length).toBeGreaterThan(0)
      expect(skillInvokedEvents[0]).toMatchObject({
        type: 'Ductus/SkillInvoked',
        payload: expect.objectContaining({
          agent: expect.any(String),
          skill: expect.any(String),
          inputHash: expect.any(String),
        }),
      })

      const completed = events.find(e => e.type === 'Ductus/AgentCompleted')!
      expect(completed.payload).toMatchObject({
        agent: 'test-agent',
        skill: 'test-skill',
        tokenUsage: { input: 10, output: 5, total: 15 },
      })
      expect(typeof (completed.payload as { durationMs: number }).durationMs).toBe('number')
    })

    it('emits ToolRequested and ToolCompleted during tool loop', async () => {
      const events: BaseEvent[] = []
      const searchTool: ToolEntity = {
        name: 'search',
        description: 'search tool',
        inputSchema: z.object({ q: z.string() }),
        execute: async (input) => `found: ${(input as { q: string }).q}`,
      }

      const transport = mockTransport([
        [toolCall('tc1', 'search', '{"q":"hello"}')],
        [text('{"answer":"done"}'), complete()],
      ])

      await invokeAgent(makeOptions({
        agent: mockAgent({ tools: [searchTool] }),
        transport,
        onEvent: (e) => events.push(e),
        observation: observeAll,
      }))

      const types = events.map(e => e.type)
      expect(types).toContain('Ductus/ToolRequested')
      expect(types).toContain('Ductus/ToolCompleted')

      const requested = events.find(e => e.type === 'Ductus/ToolRequested')!
      expect(requested.payload).toMatchObject({ agent: 'test-agent', tool: 'search' })

      const completed = events.find(e => e.type === 'Ductus/ToolCompleted')!
      expect(completed.payload).toMatchObject({ agent: 'test-agent', tool: 'search', resultSummary: 'found: hello' })
      expect(typeof (completed.payload as { durationMs: number }).durationMs).toBe('number')
    })

    it('emits AgentStreamChunk for text chunks with observeAll', async () => {
      const events: BaseEvent[] = []
      const transport = mockTransport([
        [text('{"answer":'), text('"hello"}'), complete()],
      ])

      await invokeAgent(makeOptions({
        transport,
        onEvent: (e) => events.push(e),
        observation: observeAll,
      }))

      const streamChunks = events.filter(e => e.type === 'Ductus/AgentStreamChunk')
      expect(streamChunks).toHaveLength(2)
      expect(streamChunks[0].payload).toMatchObject({ agent: 'test-agent', skill: 'test-skill', chunkType: 'text', content: '{"answer":' })
      expect(streamChunks[1].payload).toMatchObject({ content: '"hello"}' })
    })

    it('emits SkillRetry on assertion failure with retries remaining', async () => {
      const events: BaseEvent[] = []
      let assertCount = 0
      const skill = mockSkill({
        maxRetries: 1,
        assert: async () => {
          assertCount++
          if (assertCount === 1) throw new Error('bad output')
        },
      })

      const transport = mockTransport([
        [text('{"answer":"wrong"}'), complete()],
        [text('{"answer":"correct"}'), complete()],
      ])

      await invokeAgent(makeOptions({
        skill,
        transport,
        onEvent: (e) => events.push(e),
        observation: observeAll,
      }))

      const retryEvent = events.find(e => e.type === 'Ductus/SkillRetry')!
      expect(retryEvent).toBeDefined()
      expect(retryEvent.payload).toMatchObject({
        agent: 'test-agent',
        skill: 'test-skill',
        attempt: 1,
        maxRetries: 1,
        error: 'bad output',
      })
    })

    it('emits SkillFailed and AgentFailed when retries exhausted', async () => {
      const events: BaseEvent[] = []
      const skill = mockSkill({
        maxRetries: 0,
        assert: async () => { throw new Error('always fails') },
      })

      const transport = mockTransport([
        [text('{"answer":"a"}'), complete()],
      ])

      await expect(
        invokeAgent(makeOptions({
          skill,
          transport,
          onEvent: (e) => events.push(e),
          observation: observeAll,
        })),
      ).rejects.toThrow('always fails')

      const types = events.map(e => e.type)
      expect(types).toContain('Ductus/SkillFailed')
      expect(types).toContain('Ductus/AgentFailed')

      const failed = events.find(e => e.type === 'Ductus/SkillFailed')!
      expect(failed.payload).toMatchObject({
        agent: 'test-agent',
        skill: 'test-skill',
        error: 'always fails',
        retriesExhausted: true,
      })
    })

    it('emits no observation events when observation config is absent', async () => {
      const events: BaseEvent[] = []
      const transport = mockTransport([
        [text('{"answer":"hello"}'), complete()],
      ])

      await invokeAgent(makeOptions({
        transport,
        onEvent: (e) => events.push(e),
      }))

      const observationTypes = events.filter(e => e.type.startsWith('Ductus/'))
      expect(observationTypes).toHaveLength(0)
    })

    it('reads observation from agent.observation when options.observation is absent', async () => {
      const events: BaseEvent[] = []
      const transport = mockTransport([
        [text('{"answer":"hello"}'), complete()],
      ])

      await invokeAgent(makeOptions({
        agent: mockAgent({ observation: observeAll }),
        transport,
        onEvent: (e) => events.push(e),
      }))

      const types = events.map(e => e.type)
      expect(types).toContain('Ductus/AgentInvoked')
      expect(types).toContain('Ductus/AgentCompleted')
    })

    it('per-event filtering — only emits events listed in observation.events', async () => {
      const events: BaseEvent[] = []
      const searchTool: ToolEntity = {
        name: 'search',
        description: 'search tool',
        inputSchema: z.object({ q: z.string() }),
        execute: async (input) => `found: ${(input as { q: string }).q}`,
      }

      const perEventObs: ObservationConfig = {
        events: [{ event: ToolRequested }],
        skillEvents: [],
      }

      const transport = mockTransport([
        [toolCall('tc1', 'search', '{"q":"hello"}')],
        [text('{"answer":"done"}'), complete()],
      ])

      await invokeAgent(makeOptions({
        agent: mockAgent({ tools: [searchTool] }),
        transport,
        onEvent: (e) => events.push(e),
        observation: perEventObs,
      }))

      const types = events.map(e => e.type)
      expect(types).toContain('Ductus/ToolRequested')
      expect(types).not.toContain('Ductus/AgentInvoked')
      expect(types).not.toContain('Ductus/SkillInvoked')
      expect(types).not.toContain('Ductus/ToolCompleted')
      expect(types).not.toContain('Ductus/SkillCompleted')
      expect(types).not.toContain('Ductus/AgentCompleted')
    })

    it('per-skill filtering — emits skill-scoped events for matching skill', async () => {
      const events: BaseEvent[] = []
      const skill = mockSkill()

      const perSkillObs: ObservationConfig = {
        events: [],
        skillEvents: [{ skill }],
      }

      const transport = mockTransport([
        [text('{"answer":"hello"}'), complete()],
      ])

      await invokeAgent(makeOptions({
        skill,
        transport,
        onEvent: (e) => events.push(e),
        observation: perSkillObs,
      }))

      const types = events.map(e => e.type)
      expect(types).toContain('Ductus/SkillInvoked')
      expect(types).toContain('Ductus/SkillCompleted')
      expect(types).not.toContain('Ductus/AgentInvoked')
      expect(types).not.toContain('Ductus/AgentCompleted')
    })

    it('observeAllVolatility — all emitted observation events use the configured volatility', async () => {
      const events: BaseEvent[] = []
      const searchTool: ToolEntity = {
        name: 'search',
        description: 'search tool',
        inputSchema: z.object({ q: z.string() }),
        execute: async (input) => `found: ${(input as { q: string }).q}`,
      }

      const durableObs: ObservationConfig = {
        observeAll: true,
        observeAllVolatility: 'durable',
        events: [],
        skillEvents: [],
      }

      const transport = mockTransport([
        [toolCall('tc1', 'search', '{"q":"hello"}')],
        [text('{"answer":"done"}'), complete()],
      ])

      await invokeAgent(makeOptions({
        agent: mockAgent({ tools: [searchTool] }),
        transport,
        onEvent: (e) => events.push(e),
        observation: durableObs,
      }))

      expect(events.length).toBeGreaterThan(0)
      for (const evt of events) {
        expect(evt.volatility).toBe('durable' as Volatility)
      }
    })
  })
})
