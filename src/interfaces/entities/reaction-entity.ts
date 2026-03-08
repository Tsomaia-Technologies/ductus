import { CommittedEvent, EventDefinition } from '../event.js'
import { Schema } from '../schema.js'
import { AgentEntity } from './agent-entity.js'
import { SkillEntity } from './skill-entity.js'
import { AgentBuilder } from '../builders/agent-builder.js'
import { SkillBuilder } from '../builders/skill-builder.js'

export interface PipelineContext {
  agent?: AgentEntity
  skill?: SkillEntity
  triggerEvent: CommittedEvent
}

export interface InvokeStep<T extends Schema = any, U extends Schema = any> {
  type: 'invoke'
  agent: AgentBuilder
  skill: SkillBuilder<T, U>
}

export interface CaseStep {
  type: 'case'
  schema: Schema
  then: PipelineAction
}

export interface EmitStep {
  type: 'emit'
  event: EventDefinition
}

export interface MapStep<T = any, U = any> {
  type: 'map'
  transform: (data: T, context: PipelineContext) => U
}

export interface AssertStep<T = any> {
  type: 'assert'
  validate: (data: T, context: PipelineContext) => void
}

export interface ErrorStep {
  type: 'error'
  transform: (error: unknown, context: PipelineContext) => void
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
