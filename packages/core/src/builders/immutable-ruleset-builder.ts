import { BUILD } from '../interfaces/builders/__internal__.js'
import { RulesetEntity } from '../interfaces/entities/ruleset-entity.js'
import { RulesetBuilder } from '../interfaces/builders/ruleset-builder.js'

interface RulesetBuilderParams {
  name?: string
  readonly rules: string[]
}

export class ImmutableRulesetBuilder implements RulesetBuilder {
  private params: RulesetBuilderParams

  constructor() {
    this.params = {
      rules: [],
    }
  }

  name(name: string): this {
    return this.clone({ name })
  }

  rule(directive: string): this {
    return this.clone({
      rules: [...this.params.rules, directive],
    })
  }

  [BUILD](): RulesetEntity {
    if (!this.params.name) throw new Error('Ruleset requires a name.')
    if (!this.params.rules?.length) throw new Error('Ruleset requires at least one rule.')

    return {
      name: this.params.name,
      rules: [...this.params.rules],
    }
  }

  private clone(params: Partial<RulesetBuilderParams>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
