import { BaseEventDefinition, CommittedEvent, EventDefinition } from '../event.js'
import { Schema } from '../schema.js'
import { AgentEntity } from './agent-entity.js'
import { SkillEntity } from './skill-entity.js'

export interface PipelineContext {
  agent?: AgentEntity
  skill?: SkillEntity
  triggerEvent: CommittedEvent
}

export interface InvokeStep {
  type: 'invoke'
  agent: AgentEntity
  skill: SkillEntity
}

export interface CaseStep {
  type: 'case'
  schema: Schema
  then: PipelineAction
}

export interface EmitStep {
  type: 'emit'
  event: BaseEventDefinition
}

export interface MapStep<T = any, U = any> {
  type: 'map'
  transform: (data: T, context: PipelineContext) => U
}

export interface AssertStep<T = any> {
  type: 'assert'
  validate: (data: T, context: PipelineContext) => void | Promise<void>
}

export interface ErrorStep<U = any> {
  type: 'error'
  transform: (error: unknown, context: PipelineContext) => U
}

export type PipelineAction =
  | InvokeStep
  | EmitStep
  | MapStep
  | AssertStep
  | ErrorStep

export type PipelineStep =
  | PipelineAction
  | CaseStep

export interface ReactionEntity {
  name?: string | null
  triggers: string[]
  pipeline: PipelineStep[]
}
