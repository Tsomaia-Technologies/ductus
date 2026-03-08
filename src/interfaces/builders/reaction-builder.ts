import { Buildable } from './__internal__.js'
import { PipelineAction, ReactionEntity } from '../entities/reaction-entity.js'
import { EventDefinition, Infer } from '../event.js'
import { Schema } from '../schema.js'
import { AgentBuilder } from './agent-builder.js'
import { SkillBuilder } from './skill-builder.js'

export interface ReactionBuilder<T extends Schema = any, U extends Schema = any>
  extends Buildable<ReactionEntity<T, U>> {
  name(name: string): ReactionBuilder<T, U>

  when(...events: EventDefinition[]): ReactionBuilder<T, U>

  invoke<TInput extends Schema, TOutput extends Schema>(
    agent: AgentBuilder,
    skill: SkillBuilder<TInput, TOutput>,
  ): InvokeCursorBuilder<TInput, TOutput>

  emit(event: EventDefinition): ReactionBuilder<T, U>

  map<O extends Schema>(
    transform: (input: Infer<U>) => Infer<O>,
  ): ReactionBuilder<U, O>
}

/**
 * Cursor builder returned by .invoke() — provides .case() for branching
 * and escape methods to return to the main reaction builder.
 */
export interface InvokeCursorBuilder<T extends Schema, U extends Schema>
  extends ReactionBuilder<T, U> {
  case(schema: Schema, action: PipelineAction): InvokeCursorBuilder<T, U>
}
