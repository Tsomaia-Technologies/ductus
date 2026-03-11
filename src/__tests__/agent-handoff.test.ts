import { renderHandoff, getFailedSequences, AnnotatedEvent, HandoffDeps } from '../core/agent-handoff.js'
import { TemplateRenderer } from '../interfaces/template-renderer.js'
import { AgentEntity, HandoffConfig, HandoffReason } from '../interfaces/entities/agent-entity.js'
import { CommittedEvent, BaseEvent } from '../interfaces/event.js'
import { TurnRecord } from '../interfaces/agent-lifecycle.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { Injector } from '../interfaces/event-generator.js'

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

function stubFileAdapter(files?: Record<string, string>): FileAdapter {
  return {
    exists: async () => false,
    read: async (p: string, fallback?: string | null) => files?.[p] ?? fallback ?? null,
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

function makeEvent(seq: number, type = 'TestEvent', payload: unknown = {}): CommittedEvent {
  return {
    type,
    payload,
    volatility: 'durable',
    isCommited: true,
    eventId: `evt-${seq}`,
    sequenceNumber: seq,
    prevHash: 'prev',
    hash: `hash-${seq}`,
    timestamp: 1000 + seq,
  } as CommittedEvent
}

function makeEvents(count: number): CommittedEvent[] {
  return Array.from({ length: count }, (_, i) => makeEvent(i + 1))
}

function makeTurnRecord(
  turnNumber: number,
  startSeq: number,
  endSeq: number,
  failed: boolean,
): TurnRecord {
  return { turnNumber, startSequence: startSeq, endSequence: endSeq, failed }
}

function defaultParams(overrides?: Record<string, unknown>) {
  return {
    agent: buildAgent(),
    reason: 'scope' as HandoffReason,
    state: {},
    events: [] as CommittedEvent[],
    turnRecords: [] as TurnRecord[],
    failureCount: 0,
    hallucinationCount: 0,
    templateRenderer: noopRenderer,
    fileAdapter: stubFileAdapter(),
    systemAdapter: stubSystemAdapter(),
    injector: mockUse,
    ...overrides,
  }
}

describe('getFailedSequences', () => {
  it('returns empty set when no turn records', () => {
    expect(getFailedSequences([])).toEqual(new Set())
  })

  it('returns empty set when no failed turns', () => {
    const records = [
      makeTurnRecord(1, 1, 3, false),
      makeTurnRecord(2, 4, 6, false),
    ]
    expect(getFailedSequences(records)).toEqual(new Set())
  })

  it('returns sequences from failed turns', () => {
    const records = [
      makeTurnRecord(1, 1, 3, false),
      makeTurnRecord(2, 4, 6, true),
    ]
    expect(getFailedSequences(records)).toEqual(new Set([4, 5, 6]))
  })

  it('returns sequences from multiple failed turns', () => {
    const records = [
      makeTurnRecord(1, 1, 2, true),
      makeTurnRecord(2, 3, 3, false),
      makeTurnRecord(3, 4, 5, true),
    ]
    expect(getFailedSequences(records)).toEqual(new Set([1, 2, 4, 5]))
  })

  it('handles single-event failed turns', () => {
    const records = [makeTurnRecord(1, 5, 5, true)]
    expect(getFailedSequences(records)).toEqual(new Set([5]))
  })
})

describe('renderHandoff', () => {
  it('returns undefined when agent has no handoffs configured', async () => {
    const result = await renderHandoff(defaultParams())
    expect(result).toBeUndefined()
  })

  it('returns undefined when agent has empty handoffs array', async () => {
    const result = await renderHandoff(defaultParams({
      agent: buildAgent({ handoffs: [] }),
    }))
    expect(result).toBeUndefined()
  })

  it('returns undefined when no handoff matches the reason', async () => {
    const handoffs: HandoffConfig[] = [
      { reason: 'failure', template: 'failure.hbs' },
    ]
    const result = await renderHandoff(defaultParams({
      agent: buildAgent({ handoffs }),
      reason: 'scope',
    }))
    expect(result).toBeUndefined()
  })

  it('renders template for scope handoff with file-based template', async () => {
    const files: Record<string, string> = {
      'handoff.hbs': 'Handoff due to scope',
    }
    const handoffs: HandoffConfig[] = [
      { reason: 'scope', template: 'handoff.hbs' },
    ]
    const result = await renderHandoff(defaultParams({
      agent: buildAgent({ handoffs }),
      reason: 'scope',
      fileAdapter: stubFileAdapter(files),
    }))
    expect(result).toBe('Handoff due to scope')
  })

  it('renders template with event context via templateRenderer', async () => {
    const files: Record<string, string> = {
      'handoff.hbs': 'template-content',
    }
    let capturedContext: Record<string, unknown> = {}
    const renderer: TemplateRenderer = (t, ctx) => {
      capturedContext = ctx
      return `rendered: ${t}`
    }

    const handoffs: HandoffConfig[] = [
      { reason: 'scope', template: 'handoff.hbs', headEvents: 2, tailEvents: 2 },
    ]
    const events = makeEvents(4)

    const result = await renderHandoff(defaultParams({
      agent: buildAgent({ name: 'myAgent', role: 'worker', handoffs }),
      reason: 'scope',
      events,
      failureCount: 3,
      hallucinationCount: 1,
      state: { count: 42 },
      templateRenderer: renderer,
      fileAdapter: stubFileAdapter(files),
    }))

    expect(result).toBe('rendered: template-content')
    expect(capturedContext.reason).toBe('scope')
    expect(capturedContext.failureCount).toBe(3)
    expect(capturedContext.hallucinationCount).toBe(1)
    expect(capturedContext.state).toEqual({ count: 42 })
    expect((capturedContext.agent as { name: string }).name).toBe('myAgent')
    expect((capturedContext.agent as { role: string }).role).toBe('worker')
  })

  describe('head/tail windowing', () => {
    const files: Record<string, string> = { 'h.hbs': '' }

    function windowParams(eventCount: number, head: number, tail: number, reason: HandoffReason = 'scope') {
      let captured: Record<string, unknown> = {}
      const renderer: TemplateRenderer = (_t, ctx) => {
        captured = ctx
        return 'ok'
      }
      const handoffs: HandoffConfig[] = [
        { reason, template: 'h.hbs', headEvents: head, tailEvents: tail },
      ]
      return {
        params: defaultParams({
          agent: buildAgent({ handoffs }),
          reason,
          events: makeEvents(eventCount),
          templateRenderer: renderer,
          fileAdapter: stubFileAdapter(files),
        }),
        getContext: () => captured,
      }
    }

    it('puts all events in headEvents when count <= head+tail', async () => {
      const { params, getContext } = windowParams(5, 3, 3)
      await renderHandoff(params)
      const ctx = getContext()
      const head = ctx.headEvents as AnnotatedEvent[]
      const tail = ctx.tailEvents as AnnotatedEvent[]
      expect(head).toHaveLength(5)
      expect(tail).toHaveLength(0)
    })

    it('slices head and tail when count > head+tail', async () => {
      const { params, getContext } = windowParams(10, 3, 2)
      await renderHandoff(params)
      const ctx = getContext()
      const head = ctx.headEvents as AnnotatedEvent[]
      const tail = ctx.tailEvents as AnnotatedEvent[]
      expect(head).toHaveLength(3)
      expect(head.map(e => e.sequence)).toEqual([1, 2, 3])
      expect(tail).toHaveLength(2)
      expect(tail.map(e => e.sequence)).toEqual([9, 10])
    })

    it('handles zero head events', async () => {
      const { params, getContext } = windowParams(10, 0, 3)
      await renderHandoff(params)
      const ctx = getContext()
      const head = ctx.headEvents as AnnotatedEvent[]
      const tail = ctx.tailEvents as AnnotatedEvent[]
      expect(head).toHaveLength(0)
      expect(tail).toHaveLength(3)
      expect(tail.map(e => e.sequence)).toEqual([8, 9, 10])
    })

    it('handles zero tail events', async () => {
      const { params, getContext } = windowParams(10, 3, 0)
      await renderHandoff(params)
      const ctx = getContext()
      const head = ctx.headEvents as AnnotatedEvent[]
      const tail = ctx.tailEvents as AnnotatedEvent[]
      expect(head).toHaveLength(3)
      expect(tail).toHaveLength(0)
    })

    it('defaults head and tail to 0 when not configured', async () => {
      let captured: Record<string, unknown> = {}
      const renderer: TemplateRenderer = (_t, ctx) => { captured = ctx; return 'ok' }
      const handoffs: HandoffConfig[] = [
        { reason: 'scope', template: 'h.hbs' },
      ]
      await renderHandoff(defaultParams({
        agent: buildAgent({ handoffs }),
        reason: 'scope',
        events: makeEvents(5),
        templateRenderer: renderer,
        fileAdapter: stubFileAdapter(files),
      }))
      const head = captured.headEvents as AnnotatedEvent[]
      const tail = captured.tailEvents as AnnotatedEvent[]
      expect(head).toHaveLength(0)
      expect(tail).toHaveLength(0)
    })

    it('handles empty events array', async () => {
      const { params, getContext } = windowParams(0, 3, 3)
      await renderHandoff(params)
      const ctx = getContext()
      expect(ctx.headEvents).toHaveLength(0)
      expect(ctx.tailEvents).toHaveLength(0)
    })
  })

  describe('failure handoff — failed event injection', () => {
    it('injects failed events from middle into tail window', async () => {
      const files: Record<string, string> = { 'h.hbs': '' }
      let captured: Record<string, unknown> = {}
      const renderer: TemplateRenderer = (_t, ctx) => { captured = ctx; return 'ok' }
      const handoffs: HandoffConfig[] = [
        { reason: 'failure', template: 'h.hbs', headEvents: 2, tailEvents: 2 },
      ]

      const events = makeEvents(10)
      const turnRecords = [
        makeTurnRecord(1, 1, 3, false),
        makeTurnRecord(2, 4, 6, true),
        makeTurnRecord(3, 7, 10, false),
      ]

      await renderHandoff(defaultParams({
        agent: buildAgent({ handoffs }),
        reason: 'failure',
        events,
        turnRecords,
        templateRenderer: renderer,
        fileAdapter: stubFileAdapter(files),
      }))

      const tail = captured.tailEvents as AnnotatedEvent[]
      const tailSequences = tail.map(e => e.sequence)
      expect(tailSequences).toContain(4)
      expect(tailSequences).toContain(5)
      expect(tailSequences).toContain(6)
      expect(tailSequences).toContain(9)
      expect(tailSequences).toContain(10)
    })

    it('does not inject failed events for non-failure handoffs', async () => {
      const files: Record<string, string> = { 'h.hbs': '' }
      let captured: Record<string, unknown> = {}
      const renderer: TemplateRenderer = (_t, ctx) => { captured = ctx; return 'ok' }
      const handoffs: HandoffConfig[] = [
        { reason: 'scope', template: 'h.hbs', headEvents: 2, tailEvents: 2 },
      ]

      const events = makeEvents(10)
      const turnRecords = [
        makeTurnRecord(1, 1, 3, false),
        makeTurnRecord(2, 4, 6, true),
        makeTurnRecord(3, 7, 10, false),
      ]

      await renderHandoff(defaultParams({
        agent: buildAgent({ handoffs }),
        reason: 'scope',
        events,
        turnRecords,
        templateRenderer: renderer,
        fileAdapter: stubFileAdapter(files),
      }))

      const tail = captured.tailEvents as AnnotatedEvent[]
      expect(tail).toHaveLength(2)
      expect(tail.map(e => e.sequence)).toEqual([9, 10])
    })

    it('marks failed events with isFailed=true', async () => {
      const files: Record<string, string> = { 'h.hbs': '' }
      let captured: Record<string, unknown> = {}
      const renderer: TemplateRenderer = (_t, ctx) => { captured = ctx; return 'ok' }
      const handoffs: HandoffConfig[] = [
        { reason: 'failure', template: 'h.hbs', headEvents: 5, tailEvents: 5 },
      ]

      const events = makeEvents(5)
      const turnRecords = [
        makeTurnRecord(1, 1, 2, false),
        makeTurnRecord(2, 3, 5, true),
      ]

      await renderHandoff(defaultParams({
        agent: buildAgent({ handoffs }),
        reason: 'failure',
        events,
        turnRecords,
        templateRenderer: renderer,
        fileAdapter: stubFileAdapter(files),
      }))

      const head = captured.headEvents as AnnotatedEvent[]
      expect(head.find(e => e.sequence === 1)!.isFailed).toBe(false)
      expect(head.find(e => e.sequence === 2)!.isFailed).toBe(false)
      expect(head.find(e => e.sequence === 3)!.isFailed).toBe(true)
      expect(head.find(e => e.sequence === 4)!.isFailed).toBe(true)
      expect(head.find(e => e.sequence === 5)!.isFailed).toBe(true)
    })

    it('does not duplicate failed events already in tail window', async () => {
      const files: Record<string, string> = { 'h.hbs': '' }
      let captured: Record<string, unknown> = {}
      const renderer: TemplateRenderer = (_t, ctx) => { captured = ctx; return 'ok' }
      const handoffs: HandoffConfig[] = [
        { reason: 'failure', template: 'h.hbs', headEvents: 2, tailEvents: 3 },
      ]

      const events = makeEvents(8)
      // Failed turn spans sequences 6-8, which are already in the tail window (last 3)
      const turnRecords = [
        makeTurnRecord(1, 1, 5, false),
        makeTurnRecord(2, 6, 8, true),
      ]

      await renderHandoff(defaultParams({
        agent: buildAgent({ handoffs }),
        reason: 'failure',
        events,
        turnRecords,
        templateRenderer: renderer,
        fileAdapter: stubFileAdapter(files),
      }))

      const tail = captured.tailEvents as AnnotatedEvent[]
      expect(tail).toHaveLength(3)
      expect(tail.map(e => e.sequence)).toEqual([6, 7, 8])
    })
  })

  describe('async template resolver', () => {
    it('resolves inline template from async function', async () => {
      const handoffs: HandoffConfig[] = [
        { reason: 'scope', template: async () => 'Async handoff template' },
      ]

      const result = await renderHandoff(defaultParams({
        agent: buildAgent({ handoffs }),
        reason: 'scope',
      }))

      expect(result).toBe('Async handoff template')
    })

    it('resolves file template from async function returning { template }', async () => {
      const files: Record<string, string> = {
        'async-handoff.hbs': 'Loaded from file via async resolver',
      }
      const handoffs: HandoffConfig[] = [
        { reason: 'scope', template: async () => ({ template: 'async-handoff.hbs' }) },
      ]

      const result = await renderHandoff(defaultParams({
        agent: buildAgent({ handoffs }),
        reason: 'scope',
        fileAdapter: stubFileAdapter(files),
      }))

      expect(result).toBe('Loaded from file via async resolver')
    })
  })

  it('passes agentSummary through to context', async () => {
    const files: Record<string, string> = { 'h.hbs': '' }
    let captured: Record<string, unknown> = {}
    const renderer: TemplateRenderer = (_t, ctx) => { captured = ctx; return 'ok' }
    const handoffs: HandoffConfig[] = [
      { reason: 'scope', template: 'h.hbs' },
    ]

    await renderHandoff(defaultParams({
      agent: buildAgent({ handoffs }),
      reason: 'scope',
      agentSummary: 'The agent completed 5 tasks.',
      templateRenderer: renderer,
      fileAdapter: stubFileAdapter(files),
    }))

    expect(captured.agentSummary).toBe('The agent completed 5 tasks.')
  })
})
