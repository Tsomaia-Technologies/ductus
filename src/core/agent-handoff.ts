import { AgentEntity, HandoffReason, HandoffConfig } from '../interfaces/entities/agent-entity.js'
import { CommittedEvent } from '../interfaces/event.js'
import { TurnRecord } from '../interfaces/agent-lifecycle.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { Injector } from '../interfaces/event-generator.js'
import { EventLedger } from '../interfaces/event-ledger.js'

import type { TemplateRenderer } from '../interfaces/template-renderer.js'

export interface AnnotatedEvent {
  type: string
  payload: unknown
  sequence: number
  timestamp: number
  isFailed: boolean
}

export interface HandoffContext {
  reason: HandoffReason
  state: unknown
  headEvents: AnnotatedEvent[]
  tailEvents: AnnotatedEvent[]
  failureCount: number
  hallucinationCount: number
  agent: { name: string; role?: string }
  agentSummary?: string
}

export interface HandoffDeps {
  templateRenderer: TemplateRenderer
  fileAdapter: FileAdapter
  systemAdapter: SystemAdapter
  injector: Injector
  ledger?: EventLedger
}

export function getFailedSequences(turnRecords: TurnRecord[]): Set<number> {
  const failed = new Set<number>()
  for (const record of turnRecords) {
    if (record.failed) {
      for (let seq = record.startSequence; seq <= record.endSequence; seq++) {
        failed.add(seq)
      }
    }
  }
  return failed
}

function annotateEvents(
  events: CommittedEvent[],
  failedSequences: Set<number>,
): AnnotatedEvent[] {
  return events.map(e => ({
    type: e.type,
    payload: e.payload,
    sequence: e.sequenceNumber,
    timestamp: e.timestamp,
    isFailed: failedSequences.has(e.sequenceNumber),
  }))
}

function computeWindows(
  annotated: AnnotatedEvent[],
  headCount: number,
  tailCount: number,
  reason: HandoffReason,
): { headEvents: AnnotatedEvent[]; tailEvents: AnnotatedEvent[] } {
  if (annotated.length <= headCount + tailCount) {
    return { headEvents: annotated, tailEvents: [] }
  }

  const headEvents = annotated.slice(0, headCount)
  let tailEvents = annotated.slice(annotated.length - tailCount)

  if (reason === 'failure') {
    const tailSequences = new Set(tailEvents.map(e => e.sequence))
    const missedFailed = annotated
      .slice(headCount, annotated.length - tailCount)
      .filter(e => e.isFailed && !tailSequences.has(e.sequence))

    if (missedFailed.length > 0) {
      tailEvents = [...missedFailed, ...tailEvents]
    }
  }

  return { headEvents, tailEvents }
}

async function resolveTemplateContent(
  config: HandoffConfig,
  agent: AgentEntity,
  fileAdapter: FileAdapter,
  systemAdapter: SystemAdapter,
  injector: Injector,
): Promise<string> {
  const { template } = config

  if (typeof template === 'string') {
    const path = systemAdapter.resolveAbsolutePath(template)
    return await fileAdapter.read(path, '')
  }

  const resolved = await template(injector, agent)
  if (typeof resolved === 'object' && 'template' in resolved) {
    const path = systemAdapter.resolveAbsolutePath(resolved.template)
    return await fileAdapter.read(path, '')
  }
  return resolved
}

export async function readAllEvents(ledger: EventLedger): Promise<CommittedEvent[]> {
  const events: CommittedEvent[] = []
  for await (const event of ledger.readEvents()) {
    events.push(event)
  }
  return events
}

export async function renderHandoff(params: {
  agent: AgentEntity
  reason: HandoffReason
  state: unknown
  events: CommittedEvent[]
  turnRecords: TurnRecord[]
  failureCount: number
  hallucinationCount: number
  templateRenderer: TemplateRenderer
  fileAdapter: FileAdapter
  systemAdapter: SystemAdapter
  injector: Injector
  agentSummary?: string
}): Promise<string | undefined> {
  const {
    agent, reason, state, events, turnRecords,
    failureCount, hallucinationCount,
    templateRenderer, fileAdapter, systemAdapter, injector,
    agentSummary,
  } = params

  const handoffs = agent.handoffs
  if (!handoffs || handoffs.length === 0) return undefined

  const config = handoffs.find(h => h.reason === reason)
  if (!config) return undefined

  const failedSequences = getFailedSequences(turnRecords)
  const annotated = annotateEvents(events, failedSequences)
  const headCount = config.headEvents ?? 0
  const tailCount = config.tailEvents ?? 0
  const { headEvents, tailEvents } = computeWindows(annotated, headCount, tailCount, reason)

  const context: HandoffContext = {
    reason,
    state,
    headEvents,
    tailEvents,
    failureCount,
    hallucinationCount,
    agent: { name: agent.name, role: agent.role },
    agentSummary,
  }

  const templateContent = await resolveTemplateContent(config, agent, fileAdapter, systemAdapter, injector)
  return await templateRenderer(templateContent, { ...context })
}
