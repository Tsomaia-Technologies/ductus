import { z } from 'zod/v3'
import { invokeAgent, InvocationOptions } from '../core/agent-invocation.js'
import { ConversationImpl } from '../core/conversation.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { AgentTransport, TransportRequest } from '../interfaces/agent-transport.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { ToolEntity } from '../interfaces/entities/tool-entity.js'
import { Injector } from '../interfaces/event-generator.js'
import { BaseEvent } from '../interfaces/event.js'
import { AssistantMessage, ToolMessage, UserMessage } from '../interfaces/agentic-message.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTransport(responses: AgentChunk[][]): {
  transport: AgentTransport
  requests: TransportRequest[]
} {
  let callIndex = 0
  const requests: TransportRequest[] = []

  const transport: AgentTransport = {
    async *send(request: TransportRequest) {
      requests.push(request)
      const chunks = responses[callIndex++] ?? []
      for (const chunk of chunks) yield chunk
    },
    async close() {},
  }

  return { transport, requests }
}

const testModel: ModelEntity = { model: 'test-model', temperature: null }

const mockUse = (() => undefined) as unknown as Injector

function buildAgent(overrides?: Partial<AgentEntity>): AgentEntity {
  const base: AgentEntity = {
    name: 'integration-agent',
    role: 'integration-tester',
    persona: 'You are an integration test agent.',
    skill: [],
    rules: [],
    rulesets: [],
  }
  return { ...base, ...overrides } as AgentEntity
}

function buildSkill(overrides?: Partial<SkillEntity>): SkillEntity {
  return {
    name: 'integration-skill',
    input: { schema: z.object({ task: z.string() }) },
    output: z.object({ code: z.string(), files: z.array(z.string()), testsRun: z.boolean() }),
    ...overrides,
  }
}

function makeOptions(overrides?: Partial<InvocationOptions>): InvocationOptions {
  return {
    agent: buildAgent(),
    skill: buildSkill(),
    input: { task: 'implement feature' },
    conversation: ConversationImpl.create('You are a coding agent.'),
    transport: createMockTransport([]).transport,
    model: testModel,
    getState: () => ({}),
    use: mockUse,
    ...overrides,
  }
}

const text = (content: string): AgentChunk => ({ type: 'text', content, timestamp: Date.now() })
const complete = (): AgentChunk => ({ type: 'complete', timestamp: Date.now() })
const usage = (inputTokens: number, outputTokens: number): AgentChunk => ({
  type: 'usage',
  inputTokens,
  outputTokens,
  timestamp: Date.now(),
})
const toolCallChunk = (id: string, name: string, args: string): AgentChunk => ({
  type: 'tool-call',
  toolCall: { id, name, arguments: args },
  timestamp: Date.now(),
})

// ---------------------------------------------------------------------------
// Test A: Happy path with tool calls
// ---------------------------------------------------------------------------

describe('agentic integration', () => {
  it('Test A: happy path with tool calls, events, conversation growth, and token accumulation', async () => {
    const emittedEvents: BaseEvent[] = []

    const readFileTool: ToolEntity = {
      name: 'ReadFile',
      description: 'Read a file from disk',
      inputSchema: z.object({ path: z.string() }),
      execute: async (input, ctx) => {
        const filePath = (input as { path: string }).path
        ctx.emit({
          type: 'FileRead',
          payload: { path: filePath },
          volatility: 'volatile',
        })
        return `contents of ${filePath}`
      },
    }

    const runTestsTool: ToolEntity = {
      name: 'RunTests',
      description: 'Run the test suite',
      inputSchema: z.object({ suite: z.string() }),
      execute: async (input, ctx) => {
        ctx.emit({
          type: 'TestsExecuted',
          payload: { suite: (input as { suite: string }).suite },
          volatility: 'volatile',
        })
        return { passed: 3, failed: 0 }
      },
    }

    const { transport, requests } = createMockTransport([
      [
        usage(100, 50),
        toolCallChunk('tc-read', 'ReadFile', '{"path":"src/index.ts"}'),
      ],
      [
        usage(120, 40),
        toolCallChunk('tc-test', 'RunTests', '{"suite":"unit"}'),
      ],
      [
        usage(90, 60),
        text('{"code":"impl","files":["a.ts"],"testsRun":true}'),
        complete(),
      ],
    ])

    const result = await invokeAgent(
      makeOptions({
        agent: buildAgent({ tools: [readFileTool, runTestsTool] }),
        transport,
        onEvent: (ev) => emittedEvents.push(ev),
      }),
    )

    expect(result.output).toEqual({ code: 'impl', files: ['a.ts'], testsRun: true })

    expect(emittedEvents).toHaveLength(2)
    expect(emittedEvents[0].type).toBe('FileRead')
    expect(emittedEvents[1].type).toBe('TestsExecuted')

    const msgs = result.conversation.messages
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
    expect((msgs[1] as AssistantMessage).toolCall?.name).toBe('ReadFile')
    expect(msgs[2].role).toBe('tool')
    expect((msgs[2] as ToolMessage).name).toBe('ReadFile')
    expect(msgs[3].role).toBe('assistant')
    expect((msgs[3] as AssistantMessage).toolCall?.name).toBe('RunTests')
    expect(msgs[4].role).toBe('tool')
    expect((msgs[4] as ToolMessage).name).toBe('RunTests')
    expect(msgs[5].role).toBe('assistant')
    expect((msgs[5] as AssistantMessage).toolCall).toBeUndefined()

    expect(requests).toHaveLength(3)

    expect(result.tokenUsage).toEqual({ input: 310, output: 150 })
  })

  // ---------------------------------------------------------------------------
  // Test B: Skill assertion failure + retry
  // ---------------------------------------------------------------------------

  it('Test B: skill assertion failure triggers retry with feedback message', async () => {
    const skill = buildSkill({
      maxRetries: 2,
      assert: async (output) => {
        const parsed = output as { files: string[] }
        if (parsed.files.length === 0) {
          throw new Error('files array must not be empty')
        }
      },
    })

    const { transport, requests } = createMockTransport([
      [
        usage(100, 50),
        text('{"code":"x","files":[],"testsRun":false}'),
        complete(),
      ],
      [
        usage(80, 40),
        text('{"code":"x","files":["a.ts"],"testsRun":true}'),
        complete(),
      ],
    ])

    const result = await invokeAgent(makeOptions({ skill, transport }))

    expect(result.output).toEqual({ code: 'x', files: ['a.ts'], testsRun: true })

    expect(requests).toHaveLength(2)

    const secondRequest = requests[1]
    const secondConvMessages = secondRequest.conversation.messages
    const feedbackMsg = secondConvMessages[secondConvMessages.length - 1]
    expect(feedbackMsg.role).toBe('user')
    expect((feedbackMsg as UserMessage).content).toContain('files array must not be empty')
  })

  // ---------------------------------------------------------------------------
  // Test C: Retry exhaustion
  // ---------------------------------------------------------------------------

  it('Test C: retry exhaustion throws after maxRetries+1 attempts', async () => {
    const skill = buildSkill({
      maxRetries: 1,
      assert: async (output) => {
        const parsed = output as { files: string[] }
        if (parsed.files.length === 0) {
          throw new Error('files must not be empty')
        }
      },
    })

    const { transport, requests } = createMockTransport([
      [text('{"code":"x","files":[],"testsRun":false}'), complete()],
      [text('{"code":"y","files":[],"testsRun":false}'), complete()],
      [text('{"code":"z","files":["unexpected"],"testsRun":true}'), complete()],
    ])

    await expect(invokeAgent(makeOptions({ skill, transport }))).rejects.toThrow(
      'files must not be empty',
    )

    expect(requests).toHaveLength(2)
  })

  // ---------------------------------------------------------------------------
  // Test D: Conversation immutability
  // ---------------------------------------------------------------------------

  it('Test D: conversation immutability — originals are never mutated', async () => {
    const conv1 = ConversationImpl.create('system prompt')
    const conv2 = conv1.append({
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
    })

    expect(conv1.length).toBe(0)
    expect(conv2.length).toBe(1)
    expect(conv1.messages).toHaveLength(0)
    expect(conv2.messages).toHaveLength(1)

    const originalConv = ConversationImpl.create('You are a coding agent.')

    const { transport } = createMockTransport([
      [
        usage(50, 30),
        text('{"code":"impl","files":["b.ts"],"testsRun":true}'),
        complete(),
      ],
    ])

    const result = await invokeAgent(
      makeOptions({
        conversation: originalConv,
        transport,
      }),
    )

    expect(originalConv.length).toBe(0)
    expect(originalConv.messages).toHaveLength(0)

    expect(result.conversation.length).toBeGreaterThan(0)
    expect(result.conversation.messages.length).toBeGreaterThan(0)
  })
})
