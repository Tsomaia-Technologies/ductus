import { EventDefinition } from '../event.js'
import { Schema } from '../schema.js'

export interface InvokeStep {
  type: 'invoke'
  agent: string
  skill: string
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

export type PipelineAction =
  | InvokeStep
  | EmitStep

export type PipelineStep =
  | PipelineAction
  | CaseStep

export interface ReactionEntity {
  name?: string | null
  triggers: string[]
  pipeline: PipelineStep[]
}
