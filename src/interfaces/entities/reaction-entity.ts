import { Action } from '../action.js'
import { BaseEvent } from '../event.js'

export interface ReactionEntity<TEvent extends BaseEvent> {
  events: string[]
  reactions: Array<Action<TEvent>>
}
