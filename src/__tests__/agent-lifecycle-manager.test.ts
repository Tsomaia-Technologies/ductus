import { AgentLifecycleManager } from '../core/agent-lifecycle-manager.js'
import { AgentPromptComposer } from '../core/agent-prompt-composer.js'
import { TemplateRenderer } from '../interfaces/template-renderer.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { AgentTuple, AgentLifecycleState } from '../interfaces/agent-lifecycle.js'
import { AgentTransport } from '../interfaces/agent-transport.js'
import { Injector } from '../interfaces/event-generator.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { ConversationImpl } from '../core/conversation.js'

const noopRenderer: TemplateRenderer = (t) => t
const mockUse = (() => undefined) as unknown as Injector

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

function makeComposer(): AgentPromptComposer {
  return new AgentPromptComposer(noopRenderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
}

function makeMockTransport(): AgentTransport {
  return {
    async *send() { yield { type: 'complete' as const, timestamp: Date.now() } },
    async close() {},
  }
}

function makeManager(
  tuples: [string, AgentTuple][],
  composer?: AgentPromptComposer,
  getState?: () => unknown,
): AgentLifecycleManager {
  const agents = new Map<string, AgentTuple>(tuples)
  return new AgentLifecycleManager(agents, composer ?? makeComposer(), getState ?? (() => ({})))
}

describe('AgentLifecycleManager', () => {
  describe('getOrCreate', () => {
    it('creates lifecycle state on first call', async () => {
      const transport = makeMockTransport()
      const agent = buildAgent({ name: 'a1' })
      const manager = makeManager([['a1', { agent, transport }]])

      const state = await manager.getOrCreate('a1')

      expect(state).toBeDefined()
      expect(state.turns).toBe(0)
      expect(state.failures).toBe(0)
      expect(state.hallucinations).toBe(0)
      expect(state.tokensUsed).toBe(0)
      expect(state.turnRecords).toEqual([])
      expect(state.conversation.systemMessage).toBe('You are a test agent.')
      expect(state.conversation.length).toBe(0)
      expect(state.transport).toBe(transport)
    })

    it('returns same state on subsequent calls', async () => {
      const transport = makeMockTransport()
      const agent = buildAgent({ name: 'a1' })
      const manager = makeManager([['a1', { agent, transport }]])

      const state1 = await manager.getOrCreate('a1')
      const state2 = await manager.getOrCreate('a1')
      expect(state1).toBe(state2)
    })

    it('uses flow-level transport over agent defaultTransport', async () => {
      const flowTransport = makeMockTransport()
      const agentDefaultTransport = makeMockTransport()
      const agent = buildAgent({ name: 'a1', defaultTransport: agentDefaultTransport })
      const manager = makeManager([['a1', { agent, transport: flowTransport }]])

      const state = await manager.getOrCreate('a1')
      expect(state.transport).toBe(flowTransport)
    })

    it('falls back to agent defaultTransport when flow transport is absent', async () => {
      const agentDefaultTransport = makeMockTransport()
      const agent = buildAgent({ name: 'a1', defaultTransport: agentDefaultTransport })
      const manager = makeManager([['a1', { agent }]])

      const state = await manager.getOrCreate('a1')
      expect(state.transport).toBe(agentDefaultTransport)
    })

    it('throws when agent has no transport configured', async () => {
      const agent = buildAgent({ name: 'no-transport' })
      const manager = makeManager([['no-transport', { agent }]])

      await expect(manager.getOrCreate('no-transport')).rejects.toThrow('no transport')
    })

    it('composes system message using prompt composer with current state', async () => {
      let capturedState: unknown
      const renderer: TemplateRenderer = (t, ctx) => {
        capturedState = ctx.state
        return t
      }
      const composer = new AgentPromptComposer(renderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
      const transport = makeMockTransport()
      const agent = buildAgent({ name: 'a1', systemPrompt: 'State: {{state}}' })
      const appState = { count: 99 }
      const manager = makeManager([['a1', { agent, transport }]], composer, () => appState)

      await manager.getOrCreate('a1')
      expect(capturedState).toEqual({ count: 99 })
    })
  })

  describe('enforceLimits', () => {
    it('resets when failures reach maxFailures', async () => {
      const transport = makeMockTransport()
      const agent = buildAgent({ name: 'a1', maxFailures: 2 })
      const manager = makeManager([['a1', { agent, transport }]])

      const state = await manager.getOrCreate('a1')
      state.failures = 2
      state.turns = 5
      state.hallucinations = 1
      state.conversation = state.conversation.append({ role: 'user', content: 'msg', timestamp: Date.now() })

      await manager.enforceLimits('a1', state, agent)

      expect(state.failures).toBe(0)
      expect(state.hallucinations).toBe(0)
      expect(state.turns).toBe(0)
      expect(state.turnRecords).toEqual([])
      expect(state.conversation.length).toBe(0)
      expect(state.conversation.systemMessage).toBe('You are a test agent.')
    })

    it('resets when hallucinations reach maxRecognizedHallucinations', async () => {
      const transport = makeMockTransport()
      const agent = buildAgent({ name: 'a1', maxRecognizedHallucinations: 3 })
      const manager = makeManager([['a1', { agent, transport }]])

      const state = await manager.getOrCreate('a1')
      state.hallucinations = 3
      state.turns = 10

      await manager.enforceLimits('a1', state, agent)

      expect(state.hallucinations).toBe(0)
      expect(state.turns).toBe(0)
      expect(state.conversation.length).toBe(0)
    })

    it('resets when turns reach scope turn limit', async () => {
      const transport = makeMockTransport()
      const agent = buildAgent({ name: 'a1', scope: { type: 'turn', amount: 3 } })
      const manager = makeManager([['a1', { agent, transport }]])

      const state = await manager.getOrCreate('a1')
      state.turns = 3

      await manager.enforceLimits('a1', state, agent)

      expect(state.turns).toBe(0)
      expect(state.conversation.length).toBe(0)
    })

    it('resets when turns reach scope task limit', async () => {
      const transport = makeMockTransport()
      const agent = buildAgent({ name: 'a1', scope: { type: 'task', amount: 5 } })
      const manager = makeManager([['a1', { agent, transport }]])

      const state = await manager.getOrCreate('a1')
      state.turns = 5

      await manager.enforceLimits('a1', state, agent)

      expect(state.turns).toBe(0)
      expect(state.conversation.length).toBe(0)
    })

    it('does not reset for feature scope', async () => {
      const transport = makeMockTransport()
      const agent = buildAgent({ name: 'a1', scope: { type: 'feature' } })
      const manager = makeManager([['a1', { agent, transport }]])

      const state = await manager.getOrCreate('a1')
      state.turns = 100

      await manager.enforceLimits('a1', state, agent)

      expect(state.turns).toBe(100)
    })

    it('does not reset when under all limits', async () => {
      const transport = makeMockTransport()
      const agent = buildAgent({ name: 'a1', maxFailures: 10, scope: { type: 'turn', amount: 100 } })
      const manager = makeManager([['a1', { agent, transport }]])

      const state = await manager.getOrCreate('a1')
      state.failures = 1
      state.turns = 5
      const originalConv = state.conversation

      await manager.enforceLimits('a1', state, agent)

      expect(state.failures).toBe(1)
      expect(state.turns).toBe(5)
      expect(state.conversation).toBe(originalConv)
    })

    it('does not reset when no limits are configured', async () => {
      const transport = makeMockTransport()
      const agent = buildAgent({ name: 'a1' })
      const manager = makeManager([['a1', { agent, transport }]])

      const state = await manager.getOrCreate('a1')
      state.failures = 50
      state.turns = 200

      await manager.enforceLimits('a1', state, agent)

      expect(state.failures).toBe(50)
      expect(state.turns).toBe(200)
    })
  })

  describe('terminateAll', () => {
    it('closes all transports and clears lifecycle map', async () => {
      const closed: string[] = []
      const t1: AgentTransport = { async *send() {}, async close() { closed.push('a1') } }
      const t2: AgentTransport = { async *send() {}, async close() { closed.push('a2') } }
      const a1 = buildAgent({ name: 'a1' })
      const a2 = buildAgent({ name: 'a2' })
      const manager = makeManager([['a1', { agent: a1, transport: t1 }], ['a2', { agent: a2, transport: t2 }]])

      await manager.getOrCreate('a1')
      await manager.getOrCreate('a2')
      await manager.terminateAll()

      expect(closed).toContain('a1')
      expect(closed).toContain('a2')
    })

    it('handles transport close errors gracefully', async () => {
      const transport: AgentTransport = {
        async *send() {},
        async close() { throw new Error('close failed') },
      }
      const agent = buildAgent({ name: 'a1' })
      const manager = makeManager([['a1', { agent, transport }]])

      await manager.getOrCreate('a1')
      await expect(manager.terminateAll()).resolves.toBeUndefined()
    })

    it('is a no-op when no lifecycle states exist', async () => {
      const manager = makeManager([])
      await expect(manager.terminateAll()).resolves.toBeUndefined()
    })
  })
})
