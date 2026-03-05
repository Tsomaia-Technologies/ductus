import { BUILD } from '../interfaces/builders/__internal__.js'
import { AgentBuilder, SkillRef } from '../interfaces/builders/agent-builder.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'
import {
  AgentEntity,
  AgentScope,
  HandoffConfig,
  PersonaValue,
  SystemPromptValue,
} from '../interfaces/entities/agent-entity.js'
import { RulesetBuilder } from '../interfaces/builders/ruleset-builder.js'

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

  skill(skill: SkillBuilder, alias?: string): this {
    return this.clone({
      skills: [
        ...this.params.skills,
        alias ? skill.name(alias) : skill,
      ],
    })
  }

  rule(rule: string): this {
    return this.clone({
      rules: [...this.params.rules, ...rule],
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

    return {
      name: this.params.name,
      role: this.params.role,
      persona: this.params.persona,
      skill: this.params.skills.map(skill => skill[BUILD]()),
      rules: this.params.rules,
      rulesets: this.params.rulesets.map(ruleset => ruleset[BUILD]()),
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
