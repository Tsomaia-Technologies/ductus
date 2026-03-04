import { SkillEntity } from './skill-entity.js'
import { RulesetEntity } from './ruleset-entity.js'
import { Injector } from '../event-generator.js'
import { PromptTemplate } from '../prompt-template.js'

export type AgentScope =
  | { type: 'feature' }
  | { type: 'task' | 'turn'; amount: number }

export type HandoffReason = 'overflow' | 'failure' | 'scope'

/**
 * Async resolver for template fields. Called at runtime by the dispatcher
 * with the bound injector and the fully-built agent entity.
 */
export type AsyncTemplateResolver =
  (use: Injector, agent: AgentEntity) => Promise<string | { template: string }>

export type PersonaValue = string | { template: string } | AsyncTemplateResolver
export type SystemPromptValue = string | { template: string } | AsyncTemplateResolver

export interface HandoffConfig {
  reason: HandoffReason
  template: string | AsyncTemplateResolver
  headEvents?: number
  tailEvents?: number
  agentSummary?: boolean
}

export interface AgentEntity {
  name: string
  role: string
  persona: PromptTemplate<AgentEntity>
  skill: SkillEntity[]
  rules: string[]
  rulesets: RulesetEntity[]
  scope?: AgentScope
  maxContextTokens?: number
  maxFailures?: number
  maxRecognizedHallucinations?: number
  timeout?: number
  handoffs?: HandoffConfig[]
  systemPrompt?: PromptTemplate<AgentEntity>
}
