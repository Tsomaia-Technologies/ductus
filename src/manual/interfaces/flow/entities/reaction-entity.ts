import { Action } from '../../action.js'

export interface ReactionEntity<TEvent> {
  events: TEvent[]
  reactions: Array<Action<TEvent>>
}
