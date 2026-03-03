import { SkillEntity } from './skill-entity.js'
import { RulesetEntity } from './ruleset-entity.js'

export interface AgentEntity {
  name: string
  role: string
  persona: string
  skill: SkillEntity[]
  rules: string[]
  rulesets: RulesetEntity[]
}
