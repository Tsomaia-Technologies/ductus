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
import { ReactionEntity } from '../interfaces/entities/reaction-entity.js'
import { Injector } from '../interfaces/event-generator.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { StoreAdapter } from '../interfaces/store-adapter.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { ObservationConfig } from '../interfaces/observation-config.js'
import { AssistantMessage, ToolMessage, UserMessage } from '../interfaces/agentic-message.js'
import { createReactionAdapter } from '../utils/internals.js'
import { event } from '../utils/event-utils.js'

// ---------------------------------------------------------------------------
// Chunk helpers
// ---------------------------------------------------------------------------

const text = (content: string): AgentChunk => ({ type: 'text', content, timestamp: Date.now() })
const complete = (): AgentChunk => ({ type: 'complete', timestamp: Date.now() })
const usage = (inputTokens: number, outputTokens: number): AgentChunk => ({
  type: 'usage', inputTokens, outputTokens, timestamp: Date.now(),
})
const toolCallChunk = (id: string, name: string, args: string): AgentChunk => ({
  type: 'tool-call', toolCall: { id, name, arguments: args }, timestamp: Date.now(),
})

// ---------------------------------------------------------------------------
// Shared stubs
// ---------------------------------------------------------------------------

const testModel: ModelEntity = { model: 'test-model', temperature: null }
const mockUse = (() => undefined) as unknown as Injector
const observeAll: ObservationConfig = { observeAll: true, events: [], skillEvents: [] }

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

function buildAgent(overrides?: Partial<AgentEntity>): AgentEntity {
  return {
    name: 'e2e-agent',
    role: 'e2e-tester',
    persona: 'You are an end-to-end test agent.',
    skill: [],
    rules: [],
    rulesets: [],
    ...overrides,
  } as AgentEntity
}

function buildSkill(overrides?: Partial<SkillEntity>): SkillEntity {
  return {
    name: 'e2e-skill',
    input: { schema: z.object({ query: z.string() }) },
    output: z.object({ result: z.string(), source: z.string() }),
    ...overrides,
  }
}

function makeOptions(overrides?: Partial<InvocationOptions>): InvocationOptions {
  return {
    agent: buildAgent(),
    skill: buildSkill(),
    input: { query: 'test-query' },
    conversation: ConversationImpl.create('You are an e2e test agent.'),
    transport: createMockTransport([]).transport,
    model: testModel,
    getState: () => ({}),
    use: mockUse,
    ...overrides,
  }
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('invocation unit tests', () => {
  it('full path: trigger → invoke → tool loop → assertion → observation events', async () => {
    let toolExecuted = false

    const lookupTool: ToolEntity = {
      name: 'lookup',
      description: 'Lookup data by key',
      inputSchema: z.object({ key: z.string() }),
      execute: async (input) => {
        toolExecuted = true
        return `data-for-${(input as { key: string }).key}`
      },
    }

    const skill = buildSkill({
      assert: async (output) => {
        const parsed = output as { result: string; source: string }
        if (!parsed.result || !parsed.source) {
          throw new Error('output must have result and source')
        }
      },
    })

    const { transport, requests } = createMockTransport([
      [
        usage(100, 50),
        toolCallChunk('tc-lookup', 'lookup', '{"key":"alpha"}'),
      ],
      [
        usage(80, 40),
        text('{"result":"found-alpha","source":"lookup"}'),
        complete(),
      ],
    ])

    const emittedEvents: BaseEvent[] = []

    const result = await invokeAgent(
      makeOptions({
        agent: buildAgent({ tools: [lookupTool] }),
        skill,
        transport,
        onEvent: (ev) => emittedEvents.push(ev),
        observation: observeAll,
      }),
    )

    // Output parsed correctly
    expect(result.output).toEqual({ result: 'found-alpha', source: 'lookup' })

    // Tool was executed
    expect(toolExecuted).toBe(true)

    // Token usage accumulated across both transport calls
    expect(result.tokenUsage).toEqual({ input: 180, output: 90, total: 270 })

    // No assertion failures (skill.assert passed on first try)
    expect(result.assertionFailures).toBe(0)

    // Conversation grew correctly:
    // user → assistant(tool-call) → tool(result) → assistant(final)
    const msgs = result.conversation.messages
    expect(msgs).toHaveLength(4)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
    expect((msgs[1] as AssistantMessage).toolCall?.name).toBe('lookup')
    expect(msgs[2].role).toBe('tool')
    expect((msgs[2] as ToolMessage).name).toBe('lookup')
    expect((msgs[2] as ToolMessage).content).toBe('data-for-alpha')
    expect(msgs[3].role).toBe('assistant')
    expect((msgs[3] as AssistantMessage).toolCall).toBeUndefined()

    // Transport was called twice (tool-call response, then final response)
    expect(requests).toHaveLength(2)

    // Second request's conversation includes the tool result
    const secondReqConv = requests[1].conversation.messages
    const toolMsg = secondReqConv.find(
      (m): m is ToolMessage => m.role === 'tool',
    )
    expect(toolMsg).toBeDefined()
    expect(toolMsg!.content).toBe('data-for-alpha')

    // Observation events emitted in expected order
    const types = emittedEvents.map(e => e.type)
    expect(types).toContain('Ductus/AgentInvoked')
    expect(types).toContain('Ductus/SkillInvoked')
    expect(types).toContain('Ductus/ToolRequested')
    expect(types).toContain('Ductus/ToolCompleted')
    expect(types).toContain('Ductus/SkillCompleted')
    expect(types).toContain('Ductus/AgentCompleted')

    // AgentInvoked comes before ToolRequested
    expect(types.indexOf('Ductus/AgentInvoked')).toBeLessThan(types.indexOf('Ductus/ToolRequested'))
    // ToolRequested comes before ToolCompleted
    expect(types.indexOf('Ductus/ToolRequested')).toBeLessThan(types.indexOf('Ductus/ToolCompleted'))
    // SkillCompleted comes before AgentCompleted
    expect(types.indexOf('Ductus/SkillCompleted')).toBeLessThan(types.indexOf('Ductus/AgentCompleted'))

    // ToolRequested carries correct payload
    const toolReq = emittedEvents.find(e => e.type === 'Ductus/ToolRequested')!
    expect(toolReq.payload).toMatchObject({ agent: 'e2e-agent', tool: 'lookup' })

    // ToolCompleted carries result summary
    const toolComp = emittedEvents.find(e => e.type === 'Ductus/ToolCompleted')!
    expect(toolComp.payload).toMatchObject({
      agent: 'e2e-agent',
      tool: 'lookup',
      resultSummary: 'data-for-alpha',
    })

    // AgentCompleted carries token usage
    const agentComp = emittedEvents.find(e => e.type === 'Ductus/AgentCompleted')!
    expect(agentComp.payload).toMatchObject({
      agent: 'e2e-agent',
      skill: 'e2e-skill',
      tokenUsage: { input: 180, output: 90, total: 270 },
    })
  })

  it('path with assertion failure and retry', async () => {
    let assertCallCount = 0

    const skill = buildSkill({
      maxRetries: 1,
      assert: async (output) => {
        assertCallCount++
        const parsed = output as { result: string; source: string }
        if (assertCallCount === 1 && parsed.source === 'cache') {
          throw new Error('source must not be cache')
        }
      },
    })

    const { transport } = createMockTransport([
      [
        usage(50, 30),
        text('{"result":"stale","source":"cache"}'),
        complete(),
      ],
      [
        usage(60, 35),
        text('{"result":"fresh","source":"database"}'),
        complete(),
      ],
    ])

    const emittedEvents: BaseEvent[] = []

    const result = await invokeAgent(
      makeOptions({
        skill,
        transport,
        onEvent: (ev) => emittedEvents.push(ev),
        observation: observeAll,
      }),
    )

    // Second (retried) output returned
    expect(result.output).toEqual({ result: 'fresh', source: 'database' })

    // One assertion failure before success
    expect(result.assertionFailures).toBe(1)

    // SkillRetry event emitted
    const retryEvent = emittedEvents.find(e => e.type === 'Ductus/SkillRetry')!
    expect(retryEvent).toBeDefined()
    expect(retryEvent.payload).toMatchObject({
      agent: 'e2e-agent',
      skill: 'e2e-skill',
      attempt: 1,
      maxRetries: 1,
      error: 'source must not be cache',
    })

    // Conversation includes the feedback message from the retry
    const msgs = result.conversation.messages
    const feedbackMsg = msgs.find(
      (m): m is UserMessage => m.role === 'user' && m.content.includes('source must not be cache'),
    )
    expect(feedbackMsg).toBeDefined()

    // Token usage from both attempts accumulated
    expect(result.tokenUsage).toEqual({ input: 110, output: 65, total: 175 })
  })

  it('full path via dispatcher invokeAndParse', async () => {
    let toolExecuted = false

    const lookupTool: ToolEntity = {
      name: 'lookup',
      description: 'Lookup data',
      inputSchema: z.object({ key: z.string() }),
      execute: async (input) => {
        toolExecuted = true
        return `resolved-${(input as { key: string }).key}`
      },
    }

    const skill = buildSkill({
      assert: async (output) => {
        const parsed = output as { result: string; source: string }
        if (!parsed.result.startsWith('resolved')) {
          throw new Error('result must start with resolved')
        }
      },
    })

    const { transport: flowTransport, requests } = createMockTransport([
      [
        usage(100, 50),
        toolCallChunk('tc1', 'lookup', '{"key":"beta"}'),
      ],
      [
        usage(90, 45),
        text('{"result":"resolved-beta","source":"lookup-tool"}'),
        complete(),
      ],
    ])

    const agent = buildAgent({
      name: 'dispatcher-e2e-agent',
      skill: [skill],
      tools: [lookupTool],
      observation: observeAll,
    })

    const dispatcher = new AgentDispatcher({
      agents: [{ agent, model: testModel, transport: flowTransport }],
      store: stubStore(),
      templateRenderer: noopRenderer,
      injector: mockUse,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
    })

    const { output, observationEvents } = await dispatcher.invokeAndParse(
      'dispatcher-e2e-agent',
      'e2e-skill',
      { query: 'test' },
    )

    expect(output).toEqual({ result: 'resolved-beta', source: 'lookup-tool' })
    expect(toolExecuted).toBe(true)
    expect(requests).toHaveLength(2)

    const types = observationEvents.map(e => e.type)
    expect(types).toContain('Ductus/ToolRequested')
    expect(types).toContain('Ductus/ToolCompleted')
  })

  it('dispatcher path with assertion failure triggers retry and accumulates hallucinations', async () => {
    let assertCallCount = 0

    const skill = buildSkill({
      maxRetries: 1,
      assert: async () => {
        assertCallCount++
        if (assertCallCount === 1) {
          throw new Error('bad output format')
        }
      },
    })

    const { transport: flowTransport } = createMockTransport([
      [
        usage(50, 25),
        text('{"result":"wrong","source":"bad"}'),
        complete(),
      ],
      [
        usage(60, 30),
        text('{"result":"correct","source":"good"}'),
        complete(),
      ],
    ])

    const agent = buildAgent({
      name: 'retry-dispatcher-agent',
      skill: [skill],
      maxRecognizedHallucinations: 10,
    })

    const dispatcher = new AgentDispatcher({
      agents: [{ agent, model: testModel, transport: flowTransport }],
      store: stubStore(),
      templateRenderer: noopRenderer,
      injector: mockUse,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
    })

    const { output } = await dispatcher.invokeAndParse(
      'retry-dispatcher-agent',
      'e2e-skill',
      { query: 'retry-test' },
    )

    expect(output).toEqual({ result: 'correct', source: 'good' })
  })

  it('path with multiple tools and parallel tool calls', async () => {
    const toolCallLog: string[] = []

    const searchTool: ToolEntity = {
      name: 'search',
      description: 'Search for data',
      inputSchema: z.object({ q: z.string() }),
      execute: async (input) => {
        toolCallLog.push(`search:${(input as { q: string }).q}`)
        return `search-result-for-${(input as { q: string }).q}`
      },
    }

    const formatTool: ToolEntity = {
      name: 'format',
      description: 'Format output',
      inputSchema: z.object({ data: z.string() }),
      execute: async (input) => {
        toolCallLog.push(`format:${(input as { data: string }).data}`)
        return `formatted:${(input as { data: string }).data}`
      },
    }

    const { transport, requests } = createMockTransport([
      [
        usage(100, 50),
        toolCallChunk('tc-search', 'search', '{"q":"hello"}'),
        toolCallChunk('tc-format', 'format', '{"data":"world"}'),
      ],
      [
        usage(80, 40),
        text('{"result":"formatted:world","source":"search+format"}'),
        complete(),
      ],
    ])

    const emittedEvents: BaseEvent[] = []

    const result = await invokeAgent(
      makeOptions({
        agent: buildAgent({ tools: [searchTool, formatTool] }),
        transport,
        onEvent: (ev) => emittedEvents.push(ev),
        observation: observeAll,
      }),
    )

    expect(result.output).toEqual({ result: 'formatted:world', source: 'search+format' })

    // Both tools were called
    expect(toolCallLog).toEqual(['search:hello', 'format:world'])

    // Conversation has: user → assistant(2 tool calls) → tool(search) → tool(format) → assistant(final)
    const msgs = result.conversation.messages
    expect(msgs).toHaveLength(5)
    expect(msgs[0].role).toBe('user')
    expect((msgs[1] as AssistantMessage).toolCalls).toHaveLength(2)
    expect(msgs[2].role).toBe('tool')
    expect(msgs[3].role).toBe('tool')
    expect(msgs[4].role).toBe('assistant')

    // Two ToolRequested and two ToolCompleted events
    const toolReqs = emittedEvents.filter(e => e.type === 'Ductus/ToolRequested')
    const toolComps = emittedEvents.filter(e => e.type === 'Ductus/ToolCompleted')
    expect(toolReqs).toHaveLength(2)
    expect(toolComps).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Pipeline-level E2E test via createReactionAdapter
// ---------------------------------------------------------------------------

const TriggerEvent = event('test/Triggered', { query: z.string() })
const ResultEvent = event('test/Result', { result: z.string(), source: z.string() })

describe('reaction pipeline via createReactionAdapter', () => {
  it('routes trigger → executePipeline → invoke → tool loop → emit result', async () => {
    let toolExecuted = false

    const lookupTool: ToolEntity = {
      name: 'lookup',
      description: 'Lookup data by key',
      inputSchema: z.object({ key: z.string() }),
      execute: async (input) => {
        toolExecuted = true
        return `resolved-${(input as { key: string }).key}`
      },
    }

    const skill = buildSkill({
      assert: async (output) => {
        const parsed = output as { result: string; source: string }
        if (!parsed.result || !parsed.source) {
          throw new Error('output must have result and source')
        }
      },
    })

    const { transport: flowTransport } = createMockTransport([
      [
        usage(100, 50),
        toolCallChunk('tc-lookup', 'lookup', '{"key":"gamma"}'),
      ],
      [
        usage(90, 45),
        text('{"result":"resolved-gamma","source":"lookup-tool"}'),
        complete(),
      ],
    ])

    const agent = buildAgent({
      name: 'pipeline-e2e-agent',
      skill: [skill],
      tools: [lookupTool],
      observation: observeAll,
    })

    const dispatcher = new AgentDispatcher({
      agents: [{ agent, model: testModel, transport: flowTransport }],
      store: stubStore(),
      templateRenderer: noopRenderer,
      injector: mockUse,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
    })

    const reactionEntity: ReactionEntity = {
      name: 'test-reaction',
      triggers: [TriggerEvent.type],
      pipeline: [
        { type: 'invoke', agent, skill },
        { type: 'emit', event: ResultEvent },
      ],
    }

    const processor = createReactionAdapter(reactionEntity, dispatcher)

    const committedTrigger = {
      type: TriggerEvent.type,
      payload: { query: 'pipeline-test-query' },
      volatility: 'durable' as const,
      isCommited: true as const,
      eventId: 'evt-001',
      sequenceNumber: 1,
      prevHash: '0000',
      hash: 'abcd',
      timestamp: Date.now(),
    }

    async function* triggerStream(): AsyncIterable<CommittedEvent> {
      yield committedTrigger
    }

    const outputEvents: BaseEvent[] = []
    for await (const ev of processor.process(triggerStream(), () => ({}), mockUse)) {
      if (ev) outputEvents.push(ev)
    }

    expect(toolExecuted).toBe(true)

    const types = outputEvents.map(e => e.type)

    expect(types).toContain('Ductus/AgentInvoked')
    expect(types).toContain('Ductus/SkillInvoked')
    expect(types).toContain('Ductus/ToolRequested')
    expect(types).toContain('Ductus/ToolCompleted')
    expect(types).toContain('Ductus/SkillCompleted')
    expect(types).toContain('Ductus/AgentCompleted')

    expect(types.indexOf('Ductus/AgentInvoked')).toBeLessThan(types.indexOf('Ductus/ToolRequested'))
    expect(types.indexOf('Ductus/ToolRequested')).toBeLessThan(types.indexOf('Ductus/ToolCompleted'))
    expect(types.indexOf('Ductus/SkillCompleted')).toBeLessThan(types.indexOf('Ductus/AgentCompleted'))

    const resultEvent = outputEvents.find(e => e.type === 'test/Result')
    expect(resultEvent).toBeDefined()
    expect(resultEvent!.payload).toEqual({ result: 'resolved-gamma', source: 'lookup-tool' })

    expect(types.indexOf('test/Result')).toBeGreaterThan(types.indexOf('Ductus/AgentCompleted'))
  })
})
