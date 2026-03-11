import Ductus from '../factories.js'
import { BlockingMultiplexer } from '../core/multiplexer/blocking-multiplexer.js'
import { DefaultEventSequencer } from '../core/default-event-sequencer.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { AgentTransport, TransportRequest } from '../interfaces/agent-transport.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { CommittedEvent } from '../interfaces/event.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { TemplateRenderer } from '../interfaces/template-renderer.js'

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
// Reusable stubs
// ---------------------------------------------------------------------------

function createMockTransport(responses: AgentChunk[][]): {
  transport: AgentTransport
  requests: TransportRequest[]
  closeCalled: { value: boolean }
} {
  let callIndex = 0
  const requests: TransportRequest[] = []
  const closeCalled = { value: false }
  const transport: AgentTransport = {
    async *send(request: TransportRequest) {
      requests.push(request)
      const chunks = responses[callIndex++] ?? []
      for (const chunk of chunks) yield chunk
    },
    async close() { closeCalled.value = true },
  }
  return { transport, requests, closeCalled }
}

function createInMemoryLedger(): EventLedger & { events: CommittedEvent[] } {
  const events: CommittedEvent[] = []
  return {
    events,
    async *readEvents(options?: { afterSequence?: number }) {
      const after = options?.afterSequence ?? 0
      for (const e of events) {
        if (e.sequenceNumber > after) yield e
      }
    },
    async readLastEvent() {
      return events.length > 0 ? events[events.length - 1] : null
    },
    async appendEvent(event: CommittedEvent) {
      events.push(event)
    },
    async dispose() {},
  }
}

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

const noopRenderer: TemplateRenderer = (t) => t

function bootKernelDeps() {
  const ledger = createInMemoryLedger()
  const sequencer = new DefaultEventSequencer(ledger)
  const multiplexer = new BlockingMultiplexer(sequencer)
  return { ledger, sequencer, multiplexer }
}

// ---------------------------------------------------------------------------
// Test 1: Happy path — domain event → reaction → agent → tool → emit
// ---------------------------------------------------------------------------

describe('kernel E2E: agentic stack', () => {
  it('happy path: domain event triggers reaction → agent invoked with tool → domain event emitted → state reduced', async () => {
    const TaskSubmitted = Ductus.event('test/TaskSubmitted', { description: Ductus.string() })
    const TaskReviewed = Ductus.event('test/TaskReviewed', { approved: Ductus.boolean(), reason: Ductus.string() })

    let toolExecuted = false
    let toolArgs: unknown = null

    const RunTests = Ductus.tool('RunTests')
      .description('Run test suite')
      .input(Ductus.object({ files: Ductus.array(Ductus.string()) }))
      .execute(async (input) => {
        toolExecuted = true
        toolArgs = input
        return { passed: true, output: 'All tests passed' }
      })

    const ReviewSkill = Ductus.skill('ReviewSkill')
      .input(Ductus.object({ description: Ductus.string() }))
      .output(Ductus.object({ approved: Ductus.boolean(), reason: Ductus.string() }))
      .assert(async (output) => {
        const parsed = output as { approved: boolean; reason: string }
        if (typeof parsed.approved !== 'boolean') throw new Error('approved must be boolean')
        if (!parsed.reason) throw new Error('reason required')
      })

    const { transport, requests } = createMockTransport([
      [
        usage(100, 50),
        toolCallChunk('tc-1', 'RunTests', '{"files":["src/index.ts"]}'),
      ],
      [
        usage(90, 60),
        text('{"approved":true,"reason":"tests pass"}'),
        complete(),
      ],
    ])

    const ReviewerAgent = Ductus.agent('ReviewerAgent')
      .role('code-reviewer')
      .persona('You are a code reviewer.')
      .skill(ReviewSkill)
      .tool(RunTests)
      .defaultModel(Ductus.model('test-model'))
      .observeAll()

    interface State { reviewCount: number }

    const RootReducer = Ductus.reducer<State>()
      .when(TaskReviewed, (state) => [
        { reviewCount: state.reviewCount + 1 },
        [],
      ])

    const ReviewReaction = Ductus.reaction('ReviewReaction')
      .when(TaskSubmitted)
      .invoke(ReviewerAgent, ReviewSkill)
      .emit(TaskReviewed)

    const flow = Ductus.flow<State>()
      .initialState({ reviewCount: 0 })
      .reducer(RootReducer)
      .agent(ReviewerAgent, { transport })
      .reaction(ReviewReaction)

    const { ledger, sequencer, multiplexer } = bootKernelDeps()

    const committedTypes: string[] = []
    sequencer.onCommit(({ event }) => {
      committedTypes.push(event.type)
    })

    const kernel = Ductus.kernel({
      flow,
      multiplexer,
      sequencer,
      ledger,
      container: Ductus.container(),
      templateRenderer: noopRenderer,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
    })

    await kernel.boot()

    await multiplexer.broadcast(TaskSubmitted({ description: 'implement feature X' }))
    await new Promise(r => setTimeout(r, 500))

    expect(requests.length).toBeGreaterThanOrEqual(2)

    expect(toolExecuted).toBe(true)
    expect(toolArgs).toEqual({ files: ['src/index.ts'] })

    const durableEvents = ledger.events.filter(e => e.type === 'test/TaskReviewed')
    expect(durableEvents).toHaveLength(1)
    expect(durableEvents[0].payload).toEqual({ approved: true, reason: 'tests pass' })

    expect(committedTypes).toContain('Ductus/AgentInvoked')
    expect(committedTypes).toContain('Ductus/ToolRequested')
    expect(committedTypes).toContain('Ductus/ToolCompleted')
    expect(committedTypes).toContain('Ductus/AgentCompleted')
    expect(committedTypes).toContain('test/TaskSubmitted')
    expect(committedTypes).toContain('test/TaskReviewed')

    await kernel.shutdown()
  }, 15_000)

  // ---------------------------------------------------------------------------
  // Test 2: Skill assertion retry
  // ---------------------------------------------------------------------------

  it('skill assertion failure triggers retry: agent called twice, SkillRetry event committed', async () => {
    const PingEvent = Ductus.event('test/Ping', { message: Ductus.string() })
    const PongEvent = Ductus.event('test/Pong', { reply: Ductus.string() })

    let assertCallCount = 0

    const ReplySkill = Ductus.skill('ReplySkill')
      .input(Ductus.object({ message: Ductus.string() }))
      .output(Ductus.object({ reply: Ductus.string() }))
      .maxRetries(1)
      .assert(async (output) => {
        assertCallCount++
        const parsed = output as { reply: string }
        if (assertCallCount === 1 && parsed.reply === 'bad') {
          throw new Error('reply must not be bad')
        }
      })

    const { transport, requests } = createMockTransport([
      [
        usage(50, 30),
        text('{"reply":"bad"}'),
        complete(),
      ],
      [
        usage(60, 35),
        text('{"reply":"good"}'),
        complete(),
      ],
    ])

    const EchoAgent = Ductus.agent('EchoAgent')
      .role('echo')
      .persona('You echo messages.')
      .skill(ReplySkill)
      .defaultModel(Ductus.model('test-model'))
      .observeAll()

    interface State { pongCount: number }

    const RootReducer = Ductus.reducer<State>()
      .when(PongEvent, (state) => [{ pongCount: state.pongCount + 1 }, []])

    const EchoReaction = Ductus.reaction('EchoReaction')
      .when(PingEvent)
      .invoke(EchoAgent, ReplySkill)
      .emit(PongEvent)

    const flow = Ductus.flow<State>()
      .initialState({ pongCount: 0 })
      .reducer(RootReducer)
      .agent(EchoAgent, { transport })
      .reaction(EchoReaction)

    const { ledger, sequencer, multiplexer } = bootKernelDeps()

    const committedTypes: string[] = []
    sequencer.onCommit(({ event }) => {
      committedTypes.push(event.type)
    })

    const kernel = Ductus.kernel({
      flow,
      multiplexer,
      sequencer,
      ledger,
      container: Ductus.container(),
      templateRenderer: noopRenderer,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
    })

    await kernel.boot()
    await multiplexer.broadcast(PingEvent({ message: 'hello' }))
    await new Promise(r => setTimeout(r, 500))

    // Agent called twice (initial + retry)
    expect(requests).toHaveLength(2)

    // SkillRetry observation event was committed
    expect(committedTypes).toContain('Ductus/SkillRetry')

    // AgentCompleted also committed (second attempt succeeded)
    expect(committedTypes).toContain('Ductus/AgentCompleted')

    // PongEvent committed
    expect(committedTypes).toContain('test/Pong')
    const pongEvents = ledger.events.filter(e => e.type === 'test/Pong')
    expect(pongEvents).toHaveLength(1)
    expect(pongEvents[0].payload).toEqual({ reply: 'good' })

    await kernel.shutdown()
  }, 15_000)

  // ---------------------------------------------------------------------------
  // Test 3: Multiple agents in same flow
  // ---------------------------------------------------------------------------

  it('multiple agents with different reactions are both invoked', async () => {
    const OrderPlaced = Ductus.event('test/OrderPlaced', { orderId: Ductus.string() })
    const PaymentProcessed = Ductus.event('test/PaymentProcessed', { orderId: Ductus.string(), amount: Ductus.number() })
    const InventoryReserved = Ductus.event('test/InventoryReserved', { orderId: Ductus.string(), items: Ductus.number() })

    const PaymentSkill = Ductus.skill('PaymentSkill')
      .input(Ductus.object({ orderId: Ductus.string() }))
      .output(Ductus.object({ orderId: Ductus.string(), amount: Ductus.number() }))

    const InventorySkill = Ductus.skill('InventorySkill')
      .input(Ductus.object({ orderId: Ductus.string() }))
      .output(Ductus.object({ orderId: Ductus.string(), items: Ductus.number() }))

    const { transport: paymentTransport, requests: paymentRequests } = createMockTransport([
      [usage(50, 30), text('{"orderId":"ord-1","amount":99.99}'), complete()],
    ])

    const { transport: inventoryTransport, requests: inventoryRequests } = createMockTransport([
      [usage(40, 20), text('{"orderId":"ord-1","items":3}'), complete()],
    ])

    const PaymentAgent = Ductus.agent('PaymentAgent')
      .role('payment-processor')
      .persona('You process payments.')
      .skill(PaymentSkill)
      .defaultModel(Ductus.model('test-model'))
      .observeAll()

    const InventoryAgent = Ductus.agent('InventoryAgent')
      .role('inventory-manager')
      .persona('You manage inventory.')
      .skill(InventorySkill)
      .defaultModel(Ductus.model('test-model'))
      .observeAll()

    interface State { paymentsProcessed: number; inventoryReserved: number }

    const RootReducer = Ductus.reducer<State>()
      .when(PaymentProcessed, (state) => [{ ...state, paymentsProcessed: state.paymentsProcessed + 1 }, []])
      .when(InventoryReserved, (state) => [{ ...state, inventoryReserved: state.inventoryReserved + 1 }, []])

    const PaymentReaction = Ductus.reaction('PaymentReaction')
      .when(OrderPlaced)
      .invoke(PaymentAgent, PaymentSkill)
      .emit(PaymentProcessed)

    const InventoryReaction = Ductus.reaction('InventoryReaction')
      .when(OrderPlaced)
      .invoke(InventoryAgent, InventorySkill)
      .emit(InventoryReserved)

    const flow = Ductus.flow<State>()
      .initialState({ paymentsProcessed: 0, inventoryReserved: 0 })
      .reducer(RootReducer)
      .agent(PaymentAgent, { transport: paymentTransport })
      .agent(InventoryAgent, { transport: inventoryTransport })
      .reaction(PaymentReaction)
      .reaction(InventoryReaction)

    const { ledger, sequencer, multiplexer } = bootKernelDeps()

    const committedTypes: string[] = []
    sequencer.onCommit(({ event }) => {
      committedTypes.push(event.type)
    })

    const kernel = Ductus.kernel({
      flow,
      multiplexer,
      sequencer,
      ledger,
      container: Ductus.container(),
      templateRenderer: noopRenderer,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
    })

    await kernel.boot()
    await multiplexer.broadcast(OrderPlaced({ orderId: 'ord-1' }))
    await new Promise(r => setTimeout(r, 500))

    expect(paymentRequests).toHaveLength(1)
    expect(inventoryRequests).toHaveLength(1)

    const paymentEvents = ledger.events.filter(e => e.type === 'test/PaymentProcessed')
    const inventoryEvents = ledger.events.filter(e => e.type === 'test/InventoryReserved')
    expect(paymentEvents).toHaveLength(1)
    expect(inventoryEvents).toHaveLength(1)

    expect(paymentEvents[0].payload).toMatchObject({ orderId: 'ord-1', amount: 99.99 })
    expect(inventoryEvents[0].payload).toMatchObject({ orderId: 'ord-1', items: 3 })

    const agentInvokedCount = committedTypes.filter(t => t === 'Ductus/AgentInvoked').length
    const agentCompletedCount = committedTypes.filter(t => t === 'Ductus/AgentCompleted').length
    expect(agentInvokedCount).toBe(2)
    expect(agentCompletedCount).toBe(2)

    await kernel.shutdown()
  }, 15_000)

  // ---------------------------------------------------------------------------
  // Test 4: Handoff rendering on lifecycle limit
  // ---------------------------------------------------------------------------

  it('handoff context is injected into system message after failure limit is reached', async () => {
    const DoWork = Ductus.event('test/DoWork', { task: Ductus.string() })
    const WorkDone = Ductus.event('test/WorkDone', { result: Ductus.string() })

    const WorkSkill = Ductus.skill('WorkSkill')
      .input(Ductus.object({ task: Ductus.string() }))
      .output(Ductus.object({ result: Ductus.string() }))

    let callIndex = 0
    const requests: TransportRequest[] = []
    const closeCalls: number[] = []

    const handoffTransport: AgentTransport = {
      async *send(req: TransportRequest) {
        requests.push(req)
        callIndex++
        if (callIndex === 2) {
          throw new Error('simulated transport failure')
        }
        yield usage(50, 30)
        yield text('{"result":"done"}')
        yield complete()
      },
      async close() { closeCalls.push(callIndex) },
    }

    const handoffTemplate = 'HANDOFF: reason={{reason}} failures={{failureCount}}'

    const templateRenderer: TemplateRenderer = (template, context) => {
      let result = template
      for (const [key, value] of Object.entries(context)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value))
      }
      return result
    }

    const HandoffAgent = Ductus.agent('HandoffAgent')
      .role('worker')
      .persona('You are a worker.')
      .skill(WorkSkill)
      .defaultModel(Ductus.model('test-model'))
      .maxFailures(1)
      .handoff({ reason: 'failure', template: async () => handoffTemplate })
      .observeAll()

    interface State { workCount: number }

    const RootReducer = Ductus.reducer<State>()
      .when(WorkDone, (state) => [{ workCount: state.workCount + 1 }, []])

    const WorkReaction = Ductus.reaction('WorkReaction')
      .when(DoWork)
      .invoke(HandoffAgent, WorkSkill)
      .emit(WorkDone)
      .error(() => ({ result: 'error-fallback' }))

    const flow = Ductus.flow<State>()
      .initialState({ workCount: 0 })
      .reducer(RootReducer)
      .agent(HandoffAgent, { transport: handoffTransport })
      .reaction(WorkReaction)

    const { ledger, sequencer, multiplexer } = bootKernelDeps()

    const kernel = Ductus.kernel({
      flow,
      multiplexer,
      sequencer,
      ledger,
      container: Ductus.container(),
      templateRenderer,
      systemAdapter: stubSystemAdapter(),
      fileAdapter: stubFileAdapter(),
    })

    await kernel.boot()

    // Invocation 1: succeeds (callIndex becomes 1)
    await multiplexer.broadcast(DoWork({ task: 'task-1' }))
    await new Promise(r => setTimeout(r, 300))

    // Invocation 2: fails (callIndex becomes 2, transport throws)
    // The error handler catches it and emits WorkDone with fallback
    await multiplexer.broadcast(DoWork({ task: 'task-2' }))
    await new Promise(r => setTimeout(r, 300))

    // Invocation 3: lifecycle limit reached (failures=1 >= maxFailures=1)
    // enforceLimits resets conversation with handoff context in system message
    await multiplexer.broadcast(DoWork({ task: 'task-3' }))
    await new Promise(r => setTimeout(r, 300))

    // The third invocation's system message should contain handoff context
    // requests[0] = invocation 1 send
    // requests[1] = invocation 2 send (which throws)
    // requests[2] = invocation 3 send (after lifecycle reset with handoff)
    expect(requests.length).toBeGreaterThanOrEqual(3)

    const thirdRequest = requests[2]
    const systemMsg = thirdRequest.conversation.systemMessage
    expect(systemMsg).toContain('HANDOFF')
    expect(systemMsg).toContain('failure')

    await kernel.shutdown()
  }, 15_000)
})
