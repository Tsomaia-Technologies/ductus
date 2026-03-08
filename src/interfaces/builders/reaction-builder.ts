import { Buildable } from './__internal__.js'
import { PipelineContext, ReactionEntity } from '../entities/reaction-entity.js'
import { EventDefinition } from '../event.js'
import { Schema } from '../schema.js'
import { AgentBuilder } from './agent-builder.js'
import { SkillBuilder } from './skill-builder.js'

export interface InvokeBuildStep<T extends Schema = any, U extends Schema = any> {
  type: 'invoke'
  agent: AgentBuilder
  skill: SkillBuilder<T, U>
}

export interface CaseBuildStep {
  type: 'case'
  schema: Schema
  then: PipelineBuildAction
}

export interface EmitBuildStep {
  type: 'emit'
  event: EventDefinition
}

export interface MapBuildStep<T = any, U = any> {
  type: 'map'
  transform: (data: T, context: PipelineContext) => U
}

export interface AssertBuildStep<T = any> {
  type: 'assert'
  validate: (data: T, context: PipelineContext) => void
}

export interface ErrorBuildStep {
  type: 'error'
  transform: (error: unknown, context: PipelineContext) => void
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

export interface ReactionBuilder<T = any, U = any> extends Buildable<ReactionEntity> {
  name(name: string): ReactionBuilder<T, U>

  when(...events: EventDefinition[]): ReactionBuilder<T, U>

  invoke<TInput, TOutput>(
    agent: AgentBuilder,
    skill: SkillBuilder<TInput, TOutput>,
  ): InvokeCursorBuilder<TInput, TOutput>

  emit(event: EventDefinition): ReactionBuilder<T, U>

  map<O>(transform: (input: U) => O): ReactionBuilder<U, O>

  assert(
    validate: (error: unknown, context: PipelineContext) => void,
  ): ReactionBuilder<T, U>

  error<O>(transform: (error: unknown) => O): ReactionBuilder<U, O>
}

/**
 * Cursor builder returned by .invoke() — provides .case() for branching
 * and escape methods to return to the main reaction builder.
 */
export interface InvokeCursorBuilder<T, U>
  extends ReactionBuilder<T, U> {
  case(schema: Schema, action: PipelineBuildAction): InvokeCursorBuilder<T, U>
}
