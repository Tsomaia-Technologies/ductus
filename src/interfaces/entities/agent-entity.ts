import { SkillEntity } from './skill-entity.js'
import { RulesetEntity } from './ruleset-entity.js'

export type AgentScope =
  | { type: 'feature' }
  | { type: 'task' | 'turn'; amount: number }

export type HandoffReason = 'overflow' | 'failure' | 'scope'

export interface HandoffConfig {
  reason: HandoffReason
  template: string
  headEvents?: number
  tailEvents?: number
  agentSummary?: boolean
}

export interface AgentEntity {
  name: string
  role: string
  persona: string | { template: string }
  skill: SkillEntity[]
  rules: string[]
  rulesets: RulesetEntity[]
  scope?: AgentScope
  maxContextTokens?: number
  maxFailures?: number
  maxRecognizedHallucinations?: number
  timeout?: number
  handoffs?: HandoffConfig[]
  systemPrompt?: string
}
