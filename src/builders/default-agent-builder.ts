import { BUILD } from '../interfaces/builders/__internal__.js'
import { AgentBuilder, SkillRef } from '../interfaces/builders/agent-builder.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'
import { AgentEntity, AgentScope, HandoffConfig, PersonaValue, SystemPromptValue } from '../interfaces/entities/agent-entity.js'
import { RulesetBuilder } from '../interfaces/builders/ruleset-builder.js'

export class DefaultAgentBuilder implements AgentBuilder {
    private _name?: string
    private _role?: string
    private _persona?: PersonaValue
    private readonly _skills: SkillBuilder[] = []
    private readonly _rules: string[] = []
    private readonly _rulesets: RulesetBuilder[] = []
    private _scope?: AgentScope
    private _maxContextTokens?: number
    private _maxFailures?: number
    private _maxRecognizedHallucinations?: number
    private _timeout?: number
    private readonly _handoffs: HandoffConfig[] = []
    private _systemPrompt?: SystemPromptValue
    private _skillsProxy?: Record<string, SkillRef>

    get skills(): Record<string, SkillRef> {
        if (!this._name) {
            throw new Error('Cannot access skills before setting agent name.')
        }

        if (!this._skillsProxy) {
            const agentName = this._name
            this._skillsProxy = new Proxy({} as Record<string, SkillRef>, {
                get(_target, prop: string): SkillRef {
                    return { agent: agentName, skill: prop }
                },
            })
        }
        return this._skillsProxy
    }

    name(name: string): this {
        this._name = name
        return this
    }

    role(role: string): this {
        this._role = role
        return this
    }

    persona(value: PersonaValue): this {
        this._persona = value
        return this
    }

    skill(skill: SkillBuilder): this {
        this._skills.push(skill)
        return this
    }

    rule(rule: string): this {
        this._rules.push(rule)
        return this
    }

    ruleset(ruleset: RulesetBuilder): this {
        this._rulesets.push(ruleset)
        return this
    }

    systemPrompt(value: SystemPromptValue): this {
        this._systemPrompt = value
        return this
    }

    scope(type: 'feature'): this
    scope(type: 'task' | 'turn', amount: number): this
    scope(type: 'feature' | 'task' | 'turn', amount?: number): this {
        if (type === 'feature') {
            this._scope = { type }
        } else {
            this._scope = { type, amount: amount! }
        }
        return this
    }

    ephemeral(): void {
        this.scope('turn', 1)
    }

    maxContextTokens(value: number): this {
        this._maxContextTokens = value
        return this
    }

    maxFailures(value: number): this {
        this._maxFailures = value
        return this
    }

    maxRecognizedHallucinations(value: number): this {
        this._maxRecognizedHallucinations = value
        return this
    }

    timeout(timeoutMs: number): this {
        this._timeout = timeoutMs
        return this
    }

    handoff(config: HandoffConfig): this {
        const idx = this._handoffs.findIndex(h => h.reason === config.reason)
        if (idx >= 0) {
            this._handoffs[idx] = config
        } else {
            this._handoffs.push(config)
        }
        return this
    }

    [BUILD](): AgentEntity {
        if (!this._name) throw new Error('Agent requires a name.')
        if (!this._role) throw new Error('Agent requires a role.')
        if (!this._persona) throw new Error('Agent requires a persona.')

        return {
            name: this._name,
            role: this._role,
            persona: this._persona,
            skill: this._skills.map(skill => skill[BUILD]()),
            rules: this._rules,
            rulesets: this._rulesets.map(ruleset => ruleset[BUILD]()),
            scope: this._scope,
            maxContextTokens: this._maxContextTokens,
            maxFailures: this._maxFailures,
            maxRecognizedHallucinations: this._maxRecognizedHallucinations,
            timeout: this._timeout,
            handoffs: this._handoffs.length > 0 ? [...this._handoffs] : undefined,
            systemPrompt: this._systemPrompt,
        }
    }
}
