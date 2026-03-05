import { EventDefinition } from '../event.js'
import { Schema } from '../schema.js'

export type PipelineStep =
  | InvokeStep
  | CaseStep
  | EmitStep

export interface InvokeStep {
  type: 'invoke'
  agent: string
  skill: string
}

export interface CaseStep {
  type: 'case'
  schema: Schema
  then: PipelineStep[]
}

export interface EmitStep {
  type: 'emit'
  event: EventDefinition
}

export interface ReactionEntity {
  triggers: string[]
  pipeline: PipelineStep[]
}
