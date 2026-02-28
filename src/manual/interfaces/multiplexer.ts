import { EventSubscriber } from './event-subscriber.js'

export interface Multiplexer<TEventDraft, TCommitedEvent extends { isReplay?: boolean }> {
  /**
   * Creates subscriber to the commited events and returns it
   */
  subscribe(): EventSubscriber<TCommitedEvent>

  /**
   * Broadcasts event drafts as commited events to all subscribers
   *
   * @param {TEventDraft} event
   */
  broadcast(event: TEventDraft): Promise<void>

  /**
   * Replays commited event to all subscribers with "isReplay: true"
   *
   * @param {TCommited} event
   */
  replay(event: TCommitedEvent): Promise<void>
}
