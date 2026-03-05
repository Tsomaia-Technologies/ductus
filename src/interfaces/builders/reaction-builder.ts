import { Buildable } from './__internal__.js'
import { PipelineAction, ReactionEntity } from '../entities/reaction-entity.js'
import { EventDefinition } from '../event.js'
import { Schema } from '../schema.js'

export interface ReactionBuilder extends Buildable<ReactionEntity> {
  name(name: string): ReactionBuilder

  when(...events: EventDefinition[]): ReactionBuilder

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder

  emit(event: EventDefinition): ReactionBuilder
}

/**
 * Cursor builder returned by .invoke() — provides .case() for branching
 * and escape methods to return to the main reaction builder.
 */
export interface InvokeCursorBuilder extends ReactionBuilder {
  case(schema: Schema, action: PipelineAction): InvokeCursorBuilder
}
