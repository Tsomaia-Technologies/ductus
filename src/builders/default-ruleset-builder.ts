import { BUILD } from '../interfaces/builders/__internal__.js'
import { RulesetEntity } from '../interfaces/entities/ruleset-entity.js'
import { RulesetBuilder } from '../interfaces/builders/ruleset-builder.js'

export class DefaultRulesetBuilder implements RulesetBuilder {
  private _name?: string
  private _rules: string[] = []

  name(name: string): this {
    this._name = name
    return this
  }

  rule(directive: string): this {
    this._rules.push(directive)
    return this
  }

  [BUILD](): RulesetEntity {
    if (!this._name) throw new Error('Ruleset requires a name.')
    if (!this._rules?.length) throw new Error('Ruleset requires at least one rule.')

    return {
      name: this._name,
      rules: this._rules,
    }
  }
}
