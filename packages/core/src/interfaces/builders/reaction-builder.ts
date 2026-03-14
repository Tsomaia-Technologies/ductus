import { Buildable } from './__internal__.js'
import { PipelineContext, ReactionEntity } from '../entities/reaction-entity.js'
import { BaseEventDefinition, EventDefinition } from '../event.js'
import { Schema } from '../schema.js'
import { AgentBuilder } from './agent-builder.js'
import { SkillBuilder } from './skill-builder.js'

export interface InvokeBuildStep<T = any> {
  type: 'invoke'
  agent: AgentBuilder
  skill: SkillBuilder<T>
}

export interface CaseBuildStep {
  type: 'case'
  schema: Schema
  then: PipelineBuildAction
}

export interface EmitBuildStep {
  type: 'emit'
  event: BaseEventDefinition
}

export interface MapBuildStep<T = any, U = any> {
  type: 'map'
  transform: (data: T, context: PipelineContext) => U
}

export interface AssertBuildStep<T = any> {
  type: 'assert'
  validate: (data: T, context: PipelineContext) => void
}

export interface ErrorBuildStep<U = any> {
  type: 'error'
  transform: (error: unknown, context: PipelineContext) => U
}

export type PipelineBuildAction =
  | InvokeBuildStep
  | EmitBuildStep
  | MapBuildStep
  | AssertBuildStep
  | ErrorBuildStep

export type PipelineBuildStep =
  | PipelineBuildAction
  | CaseBuildStep

export interface ReactionBuilder<T = any> extends Buildable<ReactionEntity> {
  name(name: string): ReactionBuilder< T>

  when(...events: EventDefinition[]): ReactionBuilder<T>

  invoke<U>(agent: AgentBuilder, skill: SkillBuilder<U>): InvokeCursorBuilder<U>

  emit(event: BaseEventDefinition<string, T>): ReactionBuilder<T>

  map<U>(transform: (input: T, context: PipelineContext) => U): ReactionBuilder<U>

  assert(validate: (data: T, context: PipelineContext) => void): ReactionBuilder<T>

  error<U>(transform: (error: unknown, context: PipelineContext) => U): ReactionBuilder<T | U>
}

/**
 * Cursor builder returned by .invoke() — provides .case() for branching
 * and escape methods to return to the main reaction builder.
 */
export interface InvokeCursorBuilder<T>
  extends ReactionBuilder<T> {
  case(schema: Schema, action: PipelineBuildAction): InvokeCursorBuilder<T>
}
