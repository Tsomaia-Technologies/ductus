import { build, BUILD, isBuildable } from '../interfaces/builders/__internal__.js'
import { AgentBuilder, SkillRef } from '../interfaces/builders/agent-builder.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'
import {
  AgentEntity,
  AgentScope,
  HandoffConfig,
  PersonaValue,
  SkillConfig,
  SystemPromptValue,
} from '../interfaces/entities/agent-entity.js'
import { RulesetBuilder } from '../interfaces/builders/ruleset-builder.js'
import { ToolBuilder } from '../interfaces/builders/tool-builder.js'
import { ToolEntity } from '../interfaces/entities/tool-entity.js'
import { ModelBuilder } from '../interfaces/builders/model-builder.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { AgentTransport } from '../interfaces/agent-transport.js'
import { ContextPolicy, ContextPolicyName } from '../interfaces/context-policy.js'
import { ObservationEntry, SkillObservationEntry } from '../interfaces/observation-config.js'
import { BaseEventDefinition, Volatility, EVENT_DEFINITION } from '../interfaces/event.js'

interface AgentBuilderParams {
  name?: string
  role?: string
  persona?: PersonaValue
  readonly skills: SkillBuilder[]
  readonly rules: string[]
  readonly rulesets: RulesetBuilder[]
  scope?: AgentScope
  maxContextTokens?: number
  maxFailures?: number
  maxRecognizedHallucinations?: number
  timeout?: number
  readonly handoffs: HandoffConfig[]
  systemPrompt?: SystemPromptValue
  skillsProxy?: Record<string, SkillRef>
  readonly tools: ToolEntity[]
  defaultModel?: ModelEntity
  defaultTransport?: AgentTransport
  contextPolicy?: ContextPolicy | ContextPolicyName
  readonly observationEvents: ObservationEntry[]
  readonly skillObservationEntries: SkillObservationEntry[]
  observeAll?: boolean
  observeAllVolatility?: Volatility
  readonly skillConfigs: Map<string, SkillConfig>
}

export class ImmutableAgentBuilder implements AgentBuilder {
  private params: AgentBuilderParams

  constructor(base?: ImmutableAgentBuilder) {
    this.params = {
      name: undefined,
      role: undefined,
      persona: undefined,
      skills: [],
      rules: [],
      rulesets: [],
      scope: undefined,
      maxContextTokens: undefined,
      maxFailures: undefined,
      maxRecognizedHallucinations: undefined,
      timeout: undefined,
      handoffs: [],
      systemPrompt: undefined,
      skillsProxy: undefined,
      tools: [],
      defaultModel: undefined,
      defaultTransport: undefined,
      contextPolicy: undefined,
      observationEvents: [],
      skillObservationEntries: [],
      observeAll: undefined,
      observeAllVolatility: undefined,
      skillConfigs: new Map(),
      ...(base?.params ?? {}),
    }
  }

  get skills(): Record<string, SkillRef> {
    if (!this.params.name) {
      throw new Error('Cannot access skills before setting agent name.')
    }

    if (!this.params.skillsProxy) {
      const agentName = this.params.name
      this.params.skillsProxy = new Proxy({} as Record<string, SkillRef>, {
        get(_target, prop: string): SkillRef {
          return { agent: agentName, skill: prop }
        },
      })
    }
    return this.params.skillsProxy
  }

  name(name: string): this {
    return this.clone({ name })
  }

  role(role: string): this {
    return this.clone({ role })
  }

  persona(persona: PersonaValue): this {
    return this.clone({ persona })
  }

  skill(skill: SkillBuilder, aliasOrConfig?: string | SkillConfig): this {
    const isAlias = typeof aliasOrConfig === 'string'
    const resolvedSkill = isAlias ? skill.name(aliasOrConfig) : skill
    const newSkills = [...this.params.skills, resolvedSkill]

    if (!isAlias && aliasOrConfig) {
      const skillName = build(skill).name
      const newConfigs = new Map(this.params.skillConfigs)
      newConfigs.set(skillName, aliasOrConfig)
      return this.clone({ skills: newSkills, skillConfigs: newConfigs })
    }

    return this.clone({ skills: newSkills })
  }

  tool(tool: ToolBuilder | ToolEntity): this {
    const resolved = isBuildable(tool) ? build(tool) : tool
    return this.clone({ tools: [...this.params.tools, resolved] })
  }

  defaultModel(model: ModelBuilder | ModelEntity): this {
    const resolved = isBuildable(model) ? build(model) : model
    return this.clone({ defaultModel: resolved })
  }

  defaultTransport(transport: AgentTransport): this {
    return this.clone({ defaultTransport: transport })
  }

  contextPolicy(policy: ContextPolicyName | ContextPolicy): this {
    return this.clone({ contextPolicy: policy })
  }

  observe(event: BaseEventDefinition, options?: { volatility?: Volatility }): this
  observe(...events: [BaseEventDefinition, ...BaseEventDefinition[]]): this
  observe(
    eventOrFirst: BaseEventDefinition,
    optionsOrNext?: { volatility?: Volatility } | BaseEventDefinition,
    ...rest: BaseEventDefinition[]
  ): this {
    const isEvent = (v: unknown): v is BaseEventDefinition =>
      typeof v === 'function' && EVENT_DEFINITION in (v as object)

    if (optionsOrNext && !isEvent(optionsOrNext)) {
      return this.clone({
        observationEvents: [
          ...this.params.observationEvents,
          { event: eventOrFirst, volatility: (optionsOrNext as { volatility?: Volatility }).volatility },
        ],
      })
    }

    const allEvents = optionsOrNext
      ? [eventOrFirst, optionsOrNext as BaseEventDefinition, ...rest]
      : [eventOrFirst]

    return this.clone({
      observationEvents: [
        ...this.params.observationEvents,
        ...allEvents.map(event => ({ event })),
      ],
    })
  }

  observeSkill(skill: SkillBuilder, ...events: BaseEventDefinition[]): this {
    const resolvedSkill = build(skill)
    return this.clone({
      skillObservationEntries: [
        ...this.params.skillObservationEntries,
        { skill: resolvedSkill, events: events.length ? events : undefined },
      ],
    })
  }

  observeAll(options?: { volatility?: Volatility }): this {
    return this.clone({ observeAll: true, observeAllVolatility: options?.volatility })
  }

  rule(rule: string): this {
    return this.clone({
      rules: [...this.params.rules, rule],
    })
  }

  ruleset(ruleset: RulesetBuilder): this {
    return this.clone({
      rulesets: [...this.params.rulesets, ruleset],
    })
  }

  systemPrompt(systemPrompt: SystemPromptValue): this {
    return this.clone({ systemPrompt })
  }

  scope(type: 'feature'): this
  scope(type: 'task' | 'turn', amount: number): this
  scope(type: 'feature' | 'task' | 'turn', amount?: number): this {
    if (type === 'feature') {
      return this.clone({
        scope: { type: 'feature' },
      })
    }

    return this.clone({
      scope: { type, amount: Number(amount) },
    })
  }

  ephemeral(): this {
    return this.scope('turn', 1)
  }

  maxContextTokens(maxContextTokens: number): this {
    return this.clone({ maxContextTokens })
  }

  maxFailures(maxFailures: number): this {
    return this.clone({ maxFailures })
  }

  maxRecognizedHallucinations(maxRecognizedHallucinations: number): this {
    return this.clone({ maxRecognizedHallucinations })
  }

  timeout(timeoutMs: number): this {
    return this.clone({ timeout: timeoutMs })
  }

  handoff(config: HandoffConfig): this {
    const idx = this.params.handoffs.findIndex(h => h.reason === config.reason)

    if (idx >= 0) {
      return this.clone({
        handoffs: this.params.handoffs.map((h, i) => i === idx ? config : h),
      })
    }

    return this.clone({
      handoffs: [...this.params.handoffs, config],
    })
  }

  [BUILD](): AgentEntity {
    if (!this.params.name) throw new Error('Agent requires a name.')
    if (!this.params.role) throw new Error('Agent requires a role.')
    if (!this.params.persona) throw new Error('Agent requires a persona.')

    const hasObservation =
      this.params.observationEvents.length > 0 ||
      this.params.skillObservationEntries.length > 0 ||
      this.params.observeAll === true

    return {
      name: this.params.name,
      role: this.params.role,
      persona: this.params.persona,
      skill: this.params.skills.map(build),
      skillConfigs: this.params.skillConfigs.size > 0 ? new Map(this.params.skillConfigs) : undefined,
      rules: this.params.rules,
      rulesets: this.params.rulesets.map(build),
      tools: this.params.tools.length > 0 ? [...this.params.tools] : undefined,
      defaultModel: this.params.defaultModel,
      defaultTransport: this.params.defaultTransport,
      contextPolicy: this.params.contextPolicy,
      observation: hasObservation ? {
        events: [...this.params.observationEvents],
        skillEvents: [...this.params.skillObservationEntries],
        observeAll: this.params.observeAll,
        observeAllVolatility: this.params.observeAllVolatility,
      } : undefined,
      scope: this.params.scope,
      maxContextTokens: this.params.maxContextTokens,
      maxFailures: this.params.maxFailures,
      maxRecognizedHallucinations: this.params.maxRecognizedHallucinations,
      timeout: this.params.timeout,
      handoffs: this.params.handoffs.length > 0 ? [...this.params.handoffs] : undefined,
      systemPrompt: this.params.systemPrompt,
    }
  }

  private clone(params: Partial<AgentBuilderParams>): this {
    type self = this
    const Constructor = this.constructor as { new(): self }
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }

    return clone
  }
}
