import { BaseEvent } from '../event.js'
import { Schema } from '../schema.js'

export type PipelineStep<TEvent extends BaseEvent> =
  | InvokeStep
  | CaseStep<TEvent>
  | EmitStep<TEvent>

export interface InvokeStep {
  type: 'invoke'
  agent: string
  skill: string
}

export interface CaseStep<TEvent extends BaseEvent> {
  type: 'case'
  schema: Schema
  then: PipelineStep<TEvent>[]
}

export interface EmitStep<TEvent extends BaseEvent> {
  type: 'emit'
  event: TEvent
}

export interface ReactionEntity<TEvent extends BaseEvent> {
  triggers: string[]
  pipeline: PipelineStep<TEvent>[]
}
