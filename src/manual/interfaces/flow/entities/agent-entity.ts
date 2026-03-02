import { SkillEntity } from './skill-entity.js'

export interface AgentEntity {
  name: string
  role: string
  persona: string
  skill: SkillEntity[]
  rules: string[]
}
