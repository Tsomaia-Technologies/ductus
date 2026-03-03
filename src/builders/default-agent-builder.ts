import { BUILD } from '../interfaces/builders/__internal__.js'
import { AgentBuilder } from '../interfaces/builders/agent-builder.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { RulesetBuilder } from '../interfaces/builders/ruleset-builder.js'

export class DefaultAgentBuilder implements AgentBuilder {
    private _name?: string
    private _role?: string
    private _persona?: string
    private readonly _skills: SkillBuilder[] = []
    private readonly _rules: string[] = []
    private readonly _rulesets: RulesetBuilder[] = []

    name(name: string): this {
        this._name = name
        return this
    }

    role(role: string): this {
        this._role = role
        return this
    }

    persona(persona: string): this {
        this._persona = persona
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
        }
    }
}
