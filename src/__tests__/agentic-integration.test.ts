import { z } from 'zod/v3'
import { invokeAgent, InvocationOptions } from '../core/agent-invocation.js'
import { AgentDispatcher, TemplateRenderer } from '../core/agent-dispatcher.js'
import { ConversationImpl } from '../core/conversation.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { AgentTransport, TransportRequest } from '../interfaces/agent-transport.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { ToolEntity } from '../interfaces/entities/tool-entity.js'
import { Injector } from '../interfaces/event-generator.js'
import { BaseEvent } from '../interfaces/event.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { StoreAdapter } from '../interfaces/store-adapter.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
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

    expect(result.tokenUsage).toEqual({ input: 310, output: 150, total: 460 })
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

// ---------------------------------------------------------------------------
// Dispatcher transport resolution
// ---------------------------------------------------------------------------

describe('dispatcher transport resolution', () => {
  function stubLedger(): EventLedger {
    return {
      async *readEvents() {},
      async readLastEvent() { return null },
      async appendEvent() {},
      async dispose() {},
    }
  }

  function stubStore(): StoreAdapter<Record<string, never>> {
    const state: Record<string, never> = {}
    return {
      getState: () => state,
      getReducer: () => (s: Record<string, never>) => [s, []] as [Record<string, never>, BaseEvent[]],
      dispatch: () => [],
    }
  }

  const noopRenderer: TemplateRenderer = (t) => t

  function stubSystemAdapter(): SystemAdapter {
    return {
      getDefaultEnv: () => ({}),
      getDefaultCwd: () => '/tmp',
      getDefaultMaxBuffer: () => 1024,
      resolveAbsolutePath: (...segs: string[]) => segs.join('/'),
      execute: async () => ({ stdout: '', stderr: '', exitCode: 0, timedOut: false, cancelled: false }),
      spawn: () => { throw new Error('not implemented') },
      terminate: async () => {},
      prompt: async () => '',
    }
  }

  function stubFileAdapter(): FileAdapter {
    return {
      exists: async () => false,
      read: async (_p: string, fallback?: string | null) => fallback ?? null,
      readJson: async () => null,
      readLines: async function* () {},
      readLinesJsonl: async function* () {},
      readLastLineJsonl: async () => null,
      write: async () => true,
      writeJson: async () => true,
      append: async () => {},
      appendLine: async () => {},
      appendLineJsonl: async () => {},
      createDirectory: async () => true,
      createDirectoryRecursive: async () => {},
      delete: async () => true,
      open: async () => { throw new Error('not implemented') },
    } as FileAdapter
  }

  it('flowTransport is used when agent has no defaultTransport', async () => {
    const flowSendCalls: TransportRequest[] = []

    const flowTransport: AgentTransport = {
      async *send(req: TransportRequest) {
        flowSendCalls.push(req)
        yield text('{"code":"from-flow","files":["a.ts"],"testsRun":true}')
        yield complete()
      },
      async close() {},
    }

    const agent = buildAgent({
      name: 'flow-transport-agent',
      skill: [buildSkill()],
    })

    const dispatcher = new AgentDispatcher({
      agents: [{
        agent,
        model: testModel,
        flowTransport,
      }],
      ledger: stubLedger(),
      store: stubStore(),
      templateRenderer: noopRenderer,
      injector: mockUse,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
      interceptors: [],
    })

    expect(dispatcher.hasV2Transport('flow-transport-agent')).toBe(true)

    const { output } = await dispatcher.invokeAndParseV2(
      'flow-transport-agent',
      'integration-skill',
      { task: 'test' },
    )

    expect(flowSendCalls).toHaveLength(1)
    expect(output).toEqual({ code: 'from-flow', files: ['a.ts'], testsRun: true })
  })

  it('options.transport (flowTransport) takes priority over agent.defaultTransport', async () => {
    const flowSendCalls: TransportRequest[] = []
    const agentDefaultSendCalls: TransportRequest[] = []

    const flowTransport: AgentTransport = {
      async *send(req: TransportRequest) {
        flowSendCalls.push(req)
        yield text('{"code":"from-flow","files":["flow.ts"],"testsRun":true}')
        yield complete()
      },
      async close() {},
    }

    const agentDefaultTransport: AgentTransport = {
      async *send(req: TransportRequest) {
        agentDefaultSendCalls.push(req)
        yield text('{"code":"from-agent-default","files":["default.ts"],"testsRun":true}')
        yield complete()
      },
      async close() {},
    }

    const agent = buildAgent({
      name: 'priority-agent',
      skill: [buildSkill()],
      defaultTransport: agentDefaultTransport,
    })

    const dispatcher = new AgentDispatcher({
      agents: [{
        agent,
        model: testModel,
        flowTransport,
      }],
      ledger: stubLedger(),
      store: stubStore(),
      templateRenderer: noopRenderer,
      injector: mockUse,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
      interceptors: [],
    })

    const { output } = await dispatcher.invokeAndParseV2(
      'priority-agent',
      'integration-skill',
      { task: 'test' },
    )

    expect(flowSendCalls).toHaveLength(1)
    expect(agentDefaultSendCalls).toHaveLength(0)
    expect(output).toEqual({ code: 'from-flow', files: ['flow.ts'], testsRun: true })
  })

  it('V2-only agent (no adapter, no defaultTransport) works via flowTransport', async () => {
    const flowSendCalls: TransportRequest[] = []

    const flowTransport: AgentTransport = {
      async *send(req: TransportRequest) {
        flowSendCalls.push(req)
        yield text('{"code":"v2-only","files":["b.ts"],"testsRun":false}')
        yield complete()
      },
      async close() {},
    }

    const agent = buildAgent({
      name: 'v2-only-agent',
      skill: [buildSkill()],
    })

    const dispatcher = new AgentDispatcher({
      agents: [{
        agent,
        model: testModel,
        flowTransport,
      }],
      ledger: stubLedger(),
      store: stubStore(),
      templateRenderer: noopRenderer,
      injector: mockUse,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
      interceptors: [],
    })

    expect(dispatcher.hasV2Transport('v2-only-agent')).toBe(true)

    const { output } = await dispatcher.invokeAndParseV2(
      'v2-only-agent',
      'integration-skill',
      { task: 'test' },
    )

    expect(flowSendCalls).toHaveLength(1)
    expect(output).toEqual({ code: 'v2-only', files: ['b.ts'], testsRun: false })
  })
})

// ---------------------------------------------------------------------------
// V2 lifecycle limits (enforceLifecycleLimitsV2)
// ---------------------------------------------------------------------------

describe('V2 lifecycle limits', () => {
  function stubLedger(): EventLedger {
    return {
      async *readEvents() {},
      async readLastEvent() { return null },
      async appendEvent() {},
      async dispose() {},
    }
  }

  function stubStore(): StoreAdapter<Record<string, never>> {
    const state: Record<string, never> = {}
    return {
      getState: () => state,
      getReducer: () => (s: Record<string, never>) => [s, []] as [Record<string, never>, BaseEvent[]],
      dispatch: () => [],
    }
  }

  const noopRenderer: TemplateRenderer = (t) => t

  function stubSystemAdapter(): SystemAdapter {
    return {
      getDefaultEnv: () => ({}),
      getDefaultCwd: () => '/tmp',
      getDefaultMaxBuffer: () => 1024,
      resolveAbsolutePath: (...segs: string[]) => segs.join('/'),
      execute: async () => ({ stdout: '', stderr: '', exitCode: 0, timedOut: false, cancelled: false }),
      spawn: () => { throw new Error('not implemented') },
      terminate: async () => {},
      prompt: async () => '',
    }
  }

  function stubFileAdapter(): FileAdapter {
    return {
      exists: async () => false,
      read: async (_p: string, fallback?: string | null) => fallback ?? null,
      readJson: async () => null,
      readLines: async function* () {},
      readLinesJsonl: async function* () {},
      readLastLineJsonl: async () => null,
      write: async () => true,
      writeJson: async () => true,
      append: async () => {},
      appendLine: async () => {},
      appendLineJsonl: async () => {},
      createDirectory: async () => true,
      createDirectoryRecursive: async () => {},
      delete: async () => true,
      open: async () => { throw new Error('not implemented') },
    } as FileAdapter
  }

  it('resets conversation and counters when failures reach maxFailures', async () => {
    const requests: TransportRequest[] = []
    let callIndex = 0

    const flowTransport: AgentTransport = {
      async *send(req: TransportRequest) {
        requests.push(req)
        callIndex++
        if (callIndex === 2 || callIndex === 3) {
          throw new Error('simulated failure')
        }
        yield text('{"code":"ok","files":["a.ts"],"testsRun":true}')
        yield complete()
      },
      async close() {},
    }

    const agent = buildAgent({
      name: 'failure-agent',
      skill: [buildSkill()],
      maxFailures: 2,
    })

    const dispatcher = new AgentDispatcher({
      agents: [{ agent, model: testModel, flowTransport }],
      ledger: stubLedger(),
      store: stubStore(),
      templateRenderer: noopRenderer,
      injector: mockUse,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
      interceptors: [],
    })

    // Call 1: success — conversation grows to 2 messages (user + assistant)
    await dispatcher.invokeAndParseV2('failure-agent', 'integration-skill', { task: 'a' })
    expect(requests[0].conversation.length).toBe(1)

    // Calls 2 & 3: failures accumulate (failures becomes 2)
    await expect(
      dispatcher.invokeAndParseV2('failure-agent', 'integration-skill', { task: 'b' }),
    ).rejects.toThrow('simulated failure')
    await expect(
      dispatcher.invokeAndParseV2('failure-agent', 'integration-skill', { task: 'c' }),
    ).rejects.toThrow('simulated failure')

    // Call 4: enforceLifecycleLimitsV2 resets (failures=2 >= maxFailures=2)
    // After reset, conversation is fresh — transport should see only the new user message
    await dispatcher.invokeAndParseV2('failure-agent', 'integration-skill', { task: 'd' })

    const lastRequest = requests[requests.length - 1]
    expect(lastRequest.conversation.length).toBe(1)
  })

  it('resets conversation and counters when turns reach scope limit', async () => {
    const requests: TransportRequest[] = []

    const flowTransport: AgentTransport = {
      async *send(req: TransportRequest) {
        requests.push(req)
        yield text('{"code":"ok","files":["a.ts"],"testsRun":true}')
        yield complete()
      },
      async close() {},
    }

    const agent = buildAgent({
      name: 'scope-agent',
      skill: [buildSkill()],
      scope: { type: 'turn', amount: 2 },
    })

    const dispatcher = new AgentDispatcher({
      agents: [{ agent, model: testModel, flowTransport }],
      ledger: stubLedger(),
      store: stubStore(),
      templateRenderer: noopRenderer,
      injector: mockUse,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
      interceptors: [],
    })

    // Turn 1: fresh conversation, transport sees 1 message (user only)
    await dispatcher.invokeAndParseV2('scope-agent', 'integration-skill', { task: 'a' })
    expect(requests[0].conversation.length).toBe(1)

    // Turn 2: conversation has history, transport sees 3 messages (prior user+assistant + new user)
    await dispatcher.invokeAndParseV2('scope-agent', 'integration-skill', { task: 'b' })
    expect(requests[1].conversation.length).toBe(3)

    // Turn 3: enforceLifecycleLimitsV2 resets (turns=2 >= amount=2)
    // After reset, conversation is fresh — transport sees only the new user message
    await dispatcher.invokeAndParseV2('scope-agent', 'integration-skill', { task: 'c' })
    expect(requests[2].conversation.length).toBe(1)
  })

  it('does not reset when under limits', async () => {
    const requests: TransportRequest[] = []

    const flowTransport: AgentTransport = {
      async *send(req: TransportRequest) {
        requests.push(req)
        yield text('{"code":"ok","files":["a.ts"],"testsRun":true}')
        yield complete()
      },
      async close() {},
    }

    const agent = buildAgent({
      name: 'safe-agent',
      skill: [buildSkill()],
      maxFailures: 10,
      scope: { type: 'turn', amount: 100 },
    })

    const dispatcher = new AgentDispatcher({
      agents: [{ agent, model: testModel, flowTransport }],
      ledger: stubLedger(),
      store: stubStore(),
      templateRenderer: noopRenderer,
      injector: mockUse,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
      interceptors: [],
    })

    await dispatcher.invokeAndParseV2('safe-agent', 'integration-skill', { task: 'a' })
    await dispatcher.invokeAndParseV2('safe-agent', 'integration-skill', { task: 'b' })
    await dispatcher.invokeAndParseV2('safe-agent', 'integration-skill', { task: 'c' })

    // Conversation should accumulate across all 3 turns — no reset
    expect(requests[0].conversation.length).toBe(1)
    expect(requests[1].conversation.length).toBe(3)
    expect(requests[2].conversation.length).toBe(5)
  })
})
