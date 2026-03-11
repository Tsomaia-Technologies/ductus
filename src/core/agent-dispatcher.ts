import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { BaseEvent } from '../interfaces/event.js'
import { Injector } from '../interfaces/event-generator.js'
import { PromptTemplate } from '../interfaces/prompt-template.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { identity } from '../utils/common-utils.js'
import { StoreAdapter } from '../interfaces/store-adapter.js'

import { AgentLifecycleState, AgentTuple } from '../interfaces/agent-lifecycle.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { invokeAgent, AssertionExhaustedError } from './agent-invocation.js'
import { ConversationImpl } from './conversation.js'
import { ContextPolicy } from '../interfaces/context-policy.js'
import { ReplaceContextPolicy } from './context-policies/replace-context-policy.js'
import { TruncateContextPolicy } from './context-policies/truncate-context-policy.js'
import { SummarizeContextPolicy } from './context-policies/summarize-context-policy.js'
import { SlidingWindowContextPolicy } from './context-policies/sliding-window-context-policy.js'

/**
 * Generic template renderer. Engine-agnostic — user wraps their preferred
 * engine (Moxite, Handlebars, Nunjucks, etc.) in this interface.
 * Engine-specific features (pipes, helpers, filters) are configured
 * in the user's closure, invisible to the framework.
 */
export type TemplateRenderer = (template: string, context: Record<string, any>) => string | Promise<string>

export interface AgentDispatcherOptions<TState> {
  agents: AgentTuple[]
  store: StoreAdapter<TState>
  templateRenderer: TemplateRenderer
  systemAdapter: SystemAdapter
  fileAdapter: FileAdapter
  injector: Injector
}

export class AgentDispatcher<TState> {
  private readonly agents: Map<string, AgentTuple> = new Map()
  private readonly lifecycle: Map<string, AgentLifecycleState> = new Map()
  private readonly templateRenderer: TemplateRenderer
  private readonly store: StoreAdapter<TState>
  private readonly injector: Injector
  private readonly systemAdapter: SystemAdapter
  private readonly fileAdapter: FileAdapter
  private lastKnownSequence = 0

  constructor(options: AgentDispatcherOptions<TState>) {
    for (const tuple of options.agents) {
      this.agents.set(tuple.agent.name, tuple)
    }
    this.templateRenderer = options.templateRenderer
    this.store = options.store
    this.injector = options.injector
    this.systemAdapter = options.systemAdapter
    this.fileAdapter = options.fileAdapter
  }

  async terminateAll(): Promise<void> {
    for (const [name, state] of this.lifecycle) {
      try {
        await state.transport.close()
      } catch (err) {
        console.warn(`Failed to close transport for agent ${name}:`, err)
      }
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

    const persona = await this.resolvePersona(agentConfig)
    if (persona) parts.push(persona)

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
        '',
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

  // ── Invocation ──────────────────────────────────────────────────────

  async invokeAndParse(agentName: string, skillName: string, input: unknown): Promise<{
    output: unknown
    observationEvents: BaseEvent[]
  }> {
    const tuple = this.agents.get(agentName)
    if (!tuple) throw new Error(`Agent '${agentName}' not found.`)
    const skill = tuple.agent.skill.find(s => s.name === skillName)
    if (!skill) throw new Error(`Skill '${skillName}' not found on agent '${agentName}'.`)

    const state = await this.getOrCreateLifecycleState(agentName)

    await this.enforceLifecycleLimits(agentName, state, tuple.agent)
    await this.enforceContextPolicy(agentName, tuple.agent, state)

    state.turns++
    state.currentTurnStartSequence = this.lastKnownSequence + 1

    const observationEvents: BaseEvent[] = []
    let turnFailed = false

    try {
      const result = await invokeAgent({
        agent: tuple.agent,
        skill,
        input,
        conversation: state.conversation,
        transport: state.transport,
        model: tuple.model ?? tuple.agent.defaultModel,
        getState: () => this.store.getState(),
        use: this.injector,
        onEvent: (event) => observationEvents.push(event),
      })

      state.conversation = result.conversation
      state.tokensUsed += result.tokenUsage.input + result.tokenUsage.output
      state.hallucinations += result.assertionFailures

      state.turnRecords.push({
        turnNumber: state.turns,
        startSequence: state.currentTurnStartSequence,
        endSequence: this.lastKnownSequence,
        failed: false,
      })

      return { output: result.output, observationEvents }
    } catch (err) {
      turnFailed = true
      state.failures++
      if (err instanceof AssertionExhaustedError) {
        state.hallucinations += err.assertionFailures
      }

      state.turnRecords.push({
        turnNumber: state.turns,
        startSequence: state.currentTurnStartSequence,
        endSequence: this.lastKnownSequence,
        failed: turnFailed,
      })

      throw err
    }
  }

  private async getOrCreateLifecycleState(agentName: string): Promise<AgentLifecycleState> {
    let state = this.lifecycle.get(agentName)
    if (!state) {
      const tuple = this.agents.get(agentName)!
      const systemMessage = await this.composeSystemMessage(tuple.agent)

      const transport = tuple.transport ?? tuple.agent.defaultTransport
      if (!transport) {
        throw new Error(`Agent '${agentName}' has no transport configured. Set defaultTransport on the agent or provide transport in the flow registration.`)
      }

      const conversation = ConversationImpl.create(systemMessage)

      state = {
        tokensUsed: 0,
        failures: 0,
        hallucinations: 0,
        turns: 0,
        transport,
        conversation,
        turnRecords: [],
        currentTurnStartSequence: 0,
      }
      this.lifecycle.set(agentName, state)
    }
    return state
  }

  private async enforceLifecycleLimits(
    agentName: string,
    state: AgentLifecycleState,
    agentConfig: AgentEntity,
  ): Promise<void> {
    const maxFailures = agentConfig.maxFailures ?? Infinity
    const maxHallucinations = agentConfig.maxRecognizedHallucinations ?? Infinity

    let needsReset = state.failures >= maxFailures || state.hallucinations >= maxHallucinations

    if (!needsReset && agentConfig.scope) {
      const { type, amount } = agentConfig.scope as { type: string; amount?: number }
      if ((type === 'turn' || type === 'task') && amount !== undefined && state.turns >= amount) {
        needsReset = true
      }
    }

    if (needsReset) {
      const systemMessage = await this.composeSystemMessage(agentConfig)
      state.conversation = ConversationImpl.create(systemMessage)
      state.failures = 0
      state.hallucinations = 0
      state.turns = 0
      state.turnRecords = []
    }
  }

  private async enforceContextPolicy(
    agentName: string,
    agentConfig: AgentEntity,
    state: AgentLifecycleState,
  ): Promise<void> {
    if (agentConfig.maxContextTokens === undefined) return
    if (state.conversation.tokenEstimate < agentConfig.maxContextTokens) return

    const tuple = this.agents.get(agentName)
    const model = tuple?.model?.model ?? agentConfig.defaultModel?.model

    const policy = this.resolveContextPolicy(agentConfig)
    state.conversation = await policy.apply(
      state.conversation,
      agentConfig.maxContextTokens,
      state.transport,
      model,
    )
  }

  private resolveContextPolicy(agentConfig: AgentEntity): ContextPolicy {
    const { contextPolicy } = agentConfig
    if (!contextPolicy || typeof contextPolicy === 'string') {
      switch (contextPolicy) {
        case 'replace': return new ReplaceContextPolicy()
        case 'truncate': return new TruncateContextPolicy()
        case 'summarize': return new SummarizeContextPolicy()
        case 'sliding-window': return new SlidingWindowContextPolicy({ windowTokens: agentConfig.maxContextTokens ?? Infinity })
        default: return new TruncateContextPolicy()
      }
    }
    return contextPolicy
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async awaitRendered(result: string | Promise<string>): Promise<string> {
    return result
  }
}
