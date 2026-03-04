import { Buildable } from './__internal__.js'
import { RulesetEntity } from '../entities/ruleset-entity.js'

export interface RulesetBuilder extends Buildable<RulesetEntity> {
  name(name: string): this

  rule(directive: string): this
}
