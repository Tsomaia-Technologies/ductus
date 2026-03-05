import { Buildable } from './__internal__.js'
import { PipelineAction, ReactionEntity } from '../entities/reaction-entity.js'
import { EventDefinition } from '../event.js'
import { Schema } from '../schema.js'

/**
 * Cursor builder returned by .invoke() — provides .case() for branching
 * and escape methods to return to the main reaction builder.
 */
export interface InvokeCursorBuilder {
  name(name: string): ReactionBuilder

  case(schema: Schema, action: PipelineAction): InvokeCursorBuilder

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder

  emit(event: EventDefinition): ReactionBuilder

  when(...events: EventDefinition[]): ReactionBuilder
}

export interface ReactionBuilder extends Buildable<ReactionEntity> {
  name(name: string): this

  when(...events: EventDefinition[]): this

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder

  emit(event: EventDefinition): this
}
