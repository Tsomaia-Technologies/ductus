import { SkillBuilder } from './skill-builder.js'
import { Buildable } from './__internal__.js'
import { AgentEntity } from '../entities/agent-entity.js'
import { RulesetBuilder } from './ruleset-builder.js'

export interface AgentBuilder extends Buildable<AgentEntity> {
  name(name: string): this
  role(role: string): this
  persona(persona: string): this
  skill(skill: SkillBuilder): this
  rule(rule: string): this
  ruleset(ruleset: RulesetBuilder): this
}
