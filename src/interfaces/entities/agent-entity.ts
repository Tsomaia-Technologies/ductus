import { SkillEntity } from './skill-entity.js'
import { RulesetEntity } from './ruleset-entity.js'

export type AgentScope =
  | { type: 'feature' }
  | { type: 'task' | 'turn'; amount: number }

export type ContextOverflowPolicy = 'summarize' | 'truncate' | 'fresh'

export interface AgentEntity {
  name: string
  role: string
  persona: string
  skill: SkillEntity[]
  rules: string[]
  rulesets: RulesetEntity[]
  scope?: AgentScope
  maxContextTokens?: { value: number; overflowPolicy: ContextOverflowPolicy }
  maxFailures?: number
  maxRecognizedHallucinations?: number
  timeout?: number
}
