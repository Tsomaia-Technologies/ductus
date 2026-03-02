import { Action } from '../../action.js'
import { Buildable } from './__internal__.js'
import { ReactionEntity } from '../entities/reaction-entity.js'

export interface ReactionBuilder<TEvent> extends Buildable<ReactionEntity<TEvent>> {
  when(...events: TEvent[]): this
  then(action: Action<TEvent>): this
  emit(event: TEvent): this
  invoke(agentSkillId: string): this
}
