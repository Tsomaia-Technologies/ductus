import { SkillEntity } from './skill-entity.js'
import { RulesetEntity } from './ruleset-entity.js'
import { ToolEntity } from './tool-entity.js'
import { ModelEntity } from './model-entity.js'
import { Injector } from '../event-generator.js'
import { PromptTemplate } from '../prompt-template.js'
import { AgentTransport } from '../agent-transport.js'
import { ContextPolicy, ContextPolicyName } from '../context-policy.js'
import { ObservationConfig } from '../observation-config.js'

export type AgentScope =
  | { type: 'feature' }
  | { type: 'task' | 'turn'; amount: number }

export type HandoffReason = 'overflow' | 'failure' | 'scope'

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

export interface SkillConfig {
  model?: ModelEntity
  transport?: AgentTransport
  tools?: ToolEntity[]
}

export interface AgentEntity {
  name: string
  role: string
  persona: PromptTemplate<AgentEntity>
  skill: SkillEntity[]
  skillConfigs?: Map<string, SkillConfig>
  rules: string[]
  rulesets: RulesetEntity[]
  tools?: ToolEntity[]
  defaultModel?: ModelEntity
  defaultTransport?: AgentTransport
  contextPolicy?: ContextPolicy | ContextPolicyName
  observation?: ObservationConfig
  scope?: AgentScope
  maxContextTokens?: number
  maxFailures?: number
  maxRecognizedHallucinations?: number
  timeout?: number
  handoffs?: HandoffConfig[]
  systemPrompt?: PromptTemplate<AgentEntity>
}
