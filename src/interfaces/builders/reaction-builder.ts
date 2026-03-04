import { Buildable } from './__internal__.js'
import { ReactionEntity } from '../entities/reaction-entity.js'
import { BaseEvent } from '../event.js'
import { Schema } from '../schema.js'

/**
 * Cursor builder returned by .invoke() — provides .case() for branching
 * and escape methods to return to the main reaction builder.
 */
export interface InvokeCursorBuilder<TEvent extends BaseEvent> {
  case(schema: Schema, action: ReactionBuilder<TEvent>): InvokeCursorBuilder<TEvent>

  emit(event: TEvent): ReactionBuilder<TEvent>

  // Escape: return to parent builder
  when(...events: TEvent[]): ReactionBuilder<TEvent>

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder<TEvent>
}

export interface ReactionBuilder<TEvent extends BaseEvent> extends Buildable<ReactionEntity<TEvent>> {
  when(...events: TEvent[]): this

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder<TEvent>

  emit(event: TEvent): this
}
