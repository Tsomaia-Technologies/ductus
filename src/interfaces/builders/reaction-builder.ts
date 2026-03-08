import { Buildable } from './__internal__.js'
import { PipelineAction, PipelineContext, ReactionEntity } from '../entities/reaction-entity.js'
import { EventDefinition, Infer } from '../event.js'
import { Schema } from '../schema.js'
import { AgentBuilder } from './agent-builder.js'
import { SkillBuilder } from './skill-builder.js'

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
  case(schema: Schema, action: PipelineAction): InvokeCursorBuilder<T, U>
}
