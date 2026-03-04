import { Buildable } from './__internal__.js'
import { ReactionEntity } from '../entities/reaction-entity.js'
import { BaseEvent } from '../event.js'
import { Schema } from '../schema.js'

/**
 * Cursor builder returned by .invoke() — provides .case() for branching
 * and escape methods to return to the main reaction builder.
 */
export interface InvokeCursorBuilder<TEvent extends BaseEvent> {
  name(name: string): ReactionBuilder<TEvent>

  case(schema: Schema, action: ReactionBuilder<TEvent>): InvokeCursorBuilder<TEvent>

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder<TEvent>

  emit(event: TEvent): ReactionBuilder<TEvent>

  when(...events: TEvent[]): ReactionBuilder<TEvent>
}

export interface ReactionBuilder<TEvent extends BaseEvent> extends Buildable<ReactionEntity<TEvent>> {
  name(name: string): this

  when(...events: TEvent[]): this

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder<TEvent>

  emit(event: TEvent): this
}
