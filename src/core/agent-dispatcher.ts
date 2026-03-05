import { AgentEntity, HandoffReason } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { AdapterEntity, AgentAdapter } from '../interfaces/entities/adapter-entity.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { AgentContext } from '../interfaces/agent-context.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { Injector } from '../interfaces/event-generator.js'
import { PromptTemplate } from '../interfaces/prompt-template.js'
import { FileAdapter } from '../../research/interfaces/adapters.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { identity } from '../utils/common-utils.js'
import { StoreAdapter } from '../interfaces/store-adapter.js'

import { AgentTuple, AgentLifecycleState, TurnRecord } from '../interfaces/agent-lifecycle.js'
import { AgentInterceptor, InvocationContext } from './pipeline/agent-interceptor.js'
import { TemplateInterceptor } from './pipeline/interceptors/template-interceptor.js'

/**
 * Generic template renderer. Engine-agnostic — user wraps their preferred
 * engine (Moxite, Handlebars, Nunjucks, etc.) in this interface.
 * Engine-specific features (pipes, helpers, filters) are configured
 * in the user's closure, invisible to the framework.
 */
export type TemplateRenderer = (template: string, context: Record<string, any>) => string | Promise<string>

export interface AnnotatedEvent {
  type: string
  payload: unknown
  sequence: number
  timestamp: number
  isFailed: boolean
}



export interface AgentDispatcherOptions<TState> {
  agents: AgentTuple[]
  ledger: EventLedger<CommittedEvent>
  store: StoreAdapter<TState>
  templateRenderer: TemplateRenderer
  systemAdapter: SystemAdapter
  fileAdapter: FileAdapter
  injector: Injector
  interceptors?: AgentInterceptor[]
}

const DEFAULT_HEAD_EVENTS = 2
const DEFAULT_TAIL_EVENTS = 10

const AGENT_SUMMARY_PROMPT = 'Provide a concise summary of our conversation so far, including key decisions, context, and outputs.'

/**
 * Manages adapter lifecycle, tracks turn boundaries, enforces limits,
 * composes system prompts (persona + systemPrompt + handoff), and
 * renders event+state handoff context for replacement adapters.
 */
export class AgentDispatcher<TState> {
  private readonly agents: Map<string, AgentTuple> = new Map()
  private readonly lifecycle: Map<string, AgentLifecycleState> = new Map()
  private readonly templateRenderer: TemplateRenderer
  private readonly ledger: EventLedger<BaseEvent>
  private readonly store: StoreAdapter<TState>
  private readonly injector: Injector
  private readonly systemAdapter: SystemAdapter
  private readonly fileAdapter: FileAdapter
  private readonly interceptors: AgentInterceptor[]
  private lastKnownSequence = 0

  constructor(options: AgentDispatcherOptions<TState>) {
    for (const tuple of options.agents) {
      this.agents.set(tuple.agent.name, tuple)
    }
    this.templateRenderer = options.templateRenderer
    this.ledger = options.ledger
    this.store = options.store
    this.injector = options.injector
    this.systemAdapter = options.systemAdapter
    this.fileAdapter = options.fileAdapter
    this.interceptors = options.interceptors ?? [
      new TemplateInterceptor(this.fileAdapter, this.systemAdapter, this.templateRenderer)
    ]
  }

  async* invoke(agentName: string, skillName: string, input: unknown): AsyncIterable<AgentChunk> {
    const tuple = this.agents.get(agentName)
    if (!tuple) throw new Error(`Agent '${agentName}' not found.`)
    const skill = tuple.agent.skill.find(s => s.name === skillName)
    if (!skill) throw new Error(`Skill '${skillName}' not found on agent '${agentName}'.`)

    const context: InvocationContext = {
      agentName,
      skillName,
      input,
      agentTuple: tuple,
      skill,
      data: new Map()
    }

    yield* this.invokeContext(context)
  }

  async* invokeContext(context: InvocationContext): AsyncIterable<AgentChunk> {
    const { agentName, agentTuple, skill } = context
    if (!agentTuple) throw new Error(`AgentTuple missing in context for '${agentName}'.`)

    const state = await this.getOrCreateLifecycleState(agentName)
    await this.enforceLifecycleLimits(agentName, agentTuple.agent, state)
    context.state = state

    state.turns++
    state.currentTurnStartSequence = this.lastKnownSequence + 1
    let turnFailed = false

    const executePipeline = async function* (
      this: AgentDispatcher<TState>,
      ctx: InvocationContext,
      index: number,
    ): AsyncGenerator<AgentChunk, void, unknown> {
      if (index < this.interceptors.length) {
        yield* this.interceptors[index].intercept(ctx, (nextCtx) => executePipeline.call(this, nextCtx, index + 1))
      } else {
        if (!ctx.prompt) throw new Error("Prompt not generated by pipeline")
        for await (const chunk of state.adapter.process(ctx)) {
          yield chunk
          if (chunk.type === 'usage') {
            state.tokensUsed += chunk.inputTokens + chunk.outputTokens
            this.lastKnownSequence = Math.max(
              this.lastKnownSequence,
              state.currentTurnStartSequence + state.turns,
            )
          } else if (chunk.type === 'error') {
            state.failures++
            turnFailed = true
          }
        }
      }
    }.bind(this)

    yield* executePipeline(context, 0)

    state.turnRecords.push({
      turnNumber: state.turns,
      startSequence: state.currentTurnStartSequence,
      endSequence: this.lastKnownSequence,
      failed: turnFailed,
    })
  }

  async invokeAndParse(agentName: string, skillName: string, input: unknown): Promise<unknown> {
    const tuple = this.agents.get(agentName)
    if (!tuple) throw new Error(`Agent '${agentName}' not found.`)
    const skill = tuple.agent.skill.find(s => s.name === skillName)
    if (!skill) throw new Error(`Skill '${skillName}' not found on agent '${agentName}'.`)

    const context: InvocationContext = {
      agentName,
      skillName,
      input,
      agentTuple: tuple,
      skill,
      data: new Map()
    }

    const chunks: AgentChunk[] = []
    for await (const chunk of this.invokeContext(context)) {
      chunks.push(chunk)
    }

    if (!context.state?.adapter) {
      throw new Error("Agent lifecycle state or adapter missing after invocation")
    }

    return context.state.adapter.parse(chunks)
  }

  async terminateAll(): Promise<void> {
    for (const [, state] of this.lifecycle) {
      await state.adapter.terminate()
    }
    this.lifecycle.clear()
  }

  // ── Prompt Composition ────────────────────────────────────────────────

  /**
   * Composes the full system message from persona + systemPrompt.
   * Resolves async template resolvers if present.
   */
  private async composeSystemMessage(agentConfig: AgentEntity): Promise<string> {
    const parts: string[] = []

    // Layer 1: Persona
    const persona = await this.resolvePersona(agentConfig)
    if (persona) parts.push(persona)

    // Layer 2: SystemPrompt (runtime state)
    const systemPrompt = await this.resolveSystemPrompt(agentConfig)
    if (systemPrompt) parts.push(systemPrompt)

    return parts.join('\n\n')
  }

  private async formatPrompt<T>(params: {
    prompt: PromptTemplate<T>,
    entity: T,
    templateContext: Record<string, any>
    mapInline?: (inline: string) => string
  }): Promise<string | undefined> {
    let {
      prompt,
      entity,
      templateContext,
      mapInline = identity,
    } = params

    if (typeof prompt === 'function') {
      prompt = await prompt(
        this.injector,
        entity,
      )
    }

    if (typeof prompt === 'object' && 'raw' in prompt) {
      return prompt.raw
    }

    let isInline = true

    if (typeof prompt === 'object' && 'template' in prompt) {
      prompt = await this.fileAdapter.read(
        this.systemAdapter.resolveAbsolutePath(prompt.template),
      )
      isInline = false
    }

    return await this.awaitRendered(
      this.templateRenderer(
        isInline ? mapInline(String(prompt)) : String(prompt),
        templateContext,
      ),
    )
  }

  private async resolvePersona(agent: AgentEntity): Promise<string | undefined> {
    const { persona } = agent

    return await this.formatPrompt({
      prompt: persona,
      entity: agent,
      templateContext: {
        agent,
        rules: agent.rules,
        rulesets: agent.rulesets,
      },
      mapInline: value => {
        const parts = [value]

        if (agent.rules.length > 0) {
          const ruleLines = agent.rules.map(r => `- ${r}`).join('\n')
          parts.push(`\nRules:\n${ruleLines}`)
        }

        for (const ruleset of agent.rulesets) {
          const ruleLines = ruleset.rules.map(r => `- ${r}`).join('\n')
          parts.push(`\n${ruleset.name}:\n${ruleLines}`)
        }

        return parts.join('')
      },
    })
  }

  private async resolveSystemPrompt(agent: AgentEntity): Promise<string | undefined> {
    const { systemPrompt } = agent

    if (!systemPrompt) return undefined

    return await this.formatPrompt({
      prompt: systemPrompt,
      entity: agent,
      templateContext: {
        state: this.store.getState(),
      },
    })
  }

  // ── Lifecycle Management ──────────────────────────────────────────────

  private async getOrCreateLifecycleState(agentName: string): Promise<AgentLifecycleState> {
    let state = this.lifecycle.get(agentName)
    if (!state) {
      const tuple = this.agents.get(agentName)!
      const adapter = tuple.adapter.create(tuple.agent, tuple.model)

      const systemMessage = await this.composeSystemMessage(tuple.agent)

      const context: AgentContext = {
        messages: [{
          role: 'system' as const,
          content: systemMessage,
          timestamp: Date.now(),
        }],
        stats: { inputTokens: 0, outputTokens: 0, turns: 0 },
      }

      await adapter.initialize(context)

      state = {
        tokensUsed: 0,
        failures: 0,
        hallucinations: 0,
        turns: 0,
        adapter,
        turnRecords: [],
        currentTurnStartSequence: 0,
      }
      this.lifecycle.set(agentName, state)
    }
    return state
  }

  private async enforceLifecycleLimits(
    agentName: string,
    agentConfig: AgentEntity,
    state: AgentLifecycleState,
  ): Promise<void> {
    let reason: HandoffReason | null = null

    if (agentConfig.maxContextTokens !== undefined
      && state.tokensUsed >= agentConfig.maxContextTokens) {
      reason = 'overflow'
    }

    if (!reason && agentConfig.maxFailures !== undefined
      && state.failures >= agentConfig.maxFailures) {
      reason = 'failure'
    }

    if (!reason && agentConfig.maxRecognizedHallucinations !== undefined
      && state.hallucinations >= agentConfig.maxRecognizedHallucinations) {
      reason = 'failure'
    }

    if (!reason && agentConfig.scope) {
      const { type, amount } = agentConfig.scope as { type: string; amount?: number }
      if ((type === 'turn' || type === 'task') && amount !== undefined && state.turns >= amount) {
        reason = 'scope'
      }
    }

    if (reason) {
      await this.replaceAdapter(agentName, reason)
    }
  }

  // ── Adapter Replacement ───────────────────────────────────────────────

  private async replaceAdapter(agentName: string, reason: HandoffReason): Promise<void> {
    const oldState = this.lifecycle.get(agentName)
    const tuple = this.agents.get(agentName)!

    const handoff = tuple.agent.handoffs?.find(h => h.reason === reason)
    let handoffContent: string | undefined

    if (handoff) {
      // Resolve handoff template (may be async)
      let templatePath: string
      if (typeof handoff.template === 'function') {
        if (!this.injector) {
          templatePath = ''
        } else {
          const resolved = await handoff.template(this.injector, tuple.agent)
          templatePath = typeof resolved === 'string' ? resolved : resolved.template
        }
      } else {
        templatePath = handoff.template
      }

      if (templatePath) {
        const allEvents = await this.readAllEvents()
        const failedSequences = this.getFailedSequences(oldState)

        const annotated = allEvents.map(e => ({
          type: e.type,
          payload: e.payload,
          sequence: e.sequenceNumber,
          timestamp: e.timestamp,
          isFailed: failedSequences.has(e.sequenceNumber),
        }))

        const headCount = handoff.headEvents ?? DEFAULT_HEAD_EVENTS
        const tailCount = handoff.tailEvents ?? DEFAULT_TAIL_EVENTS

        let headEvents: AnnotatedEvent[]
        let tailEvents: AnnotatedEvent[]

        if (annotated.length <= headCount + tailCount) {
          headEvents = annotated
          tailEvents = []
        } else {
          headEvents = annotated.slice(0, headCount)
          tailEvents = annotated.slice(-tailCount)

          if (reason === 'failure') {
            const failedEvents = annotated.filter(e => e.isFailed)
            const tailSequences = new Set(tailEvents.map(e => e.sequence))
            for (const fe of failedEvents) {
              if (!tailSequences.has(fe.sequence)) {
                tailEvents.push(fe)
              }
            }
            tailEvents.sort((a, b) => a.sequence - b.sequence)
          }
        }

        // Opt-in agent summary for scope handoffs
        let agentSummary: string | undefined
        if (handoff.agentSummary && reason === 'scope' && oldState) {
          let summary = ''
          const summaryContext: InvocationContext = {
            agentName,
            skillName: 'system-handoff',
            input: AGENT_SUMMARY_PROMPT,
            prompt: AGENT_SUMMARY_PROMPT,
            data: new Map()
          }
          for await (const chunk of oldState.adapter.process(summaryContext)) {
            if (chunk.type === 'text') {
              summary += chunk.content
            }
          }
          agentSummary = summary
        }

        const templateContent = await this.fileAdapter.read(
          this.systemAdapter.resolveAbsolutePath(templatePath),
        )

        handoffContent = await this.awaitRendered(
          this.templateRenderer(templateContent, {
            reason,
            state: this.store.getState(),
            headEvents,
            tailEvents,
            failureCount: oldState?.failures ?? 0,
            hallucinationCount: oldState?.hallucinations ?? 0,
            agent: {
              name: tuple.agent.name,
              role: tuple.agent.role,
            },
            agentSummary,
          }),
        )
      }
    }

    // Terminate old adapter
    if (oldState) {
      await oldState.adapter.terminate()
    }

    // Create new adapter with composed system message + handoff context
    const newAdapter = tuple.adapter.create(tuple.agent, tuple.model)
    const systemMessage = await this.composeSystemMessage(tuple.agent)

    const fullMessage = handoffContent
      ? `${systemMessage}\n\n${handoffContent}`
      : systemMessage

    const context: AgentContext = {
      messages: [{
        role: 'system' as const,
        content: fullMessage,
        timestamp: Date.now(),
      }],
      stats: { inputTokens: 0, outputTokens: 0, turns: 0 },
    }

    await newAdapter.initialize(context)

    this.lifecycle.set(agentName, {
      tokensUsed: 0,
      failures: 0,
      hallucinations: 0,
      turns: 0,
      adapter: newAdapter,
      turnRecords: [],
      currentTurnStartSequence: 0,
    })
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private getFailedSequences(state: AgentLifecycleState | undefined): Set<number> {
    const set = new Set<number>()
    if (!state) return set

    for (const turn of state.turnRecords) {
      if (turn.failed) {
        for (let seq = turn.startSequence; seq <= turn.endSequence; seq++) {
          set.add(seq)
        }
      }
    }
    return set
  }

  private async readAllEvents(): Promise<CommittedEvent[]> {
    if (!this.ledger) return []

    const events: CommittedEvent[] = []
    for await (const event of this.ledger.readEvents()) {
      events.push(event)
    }
    return events
  }

  private async awaitRendered(result: string | Promise<string>): Promise<string> {
    return result
  }
}
