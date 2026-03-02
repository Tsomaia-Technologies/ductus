import { Buildable } from './__internal__.js'
import { EventEntity } from '../entities/event-entity.js'

export interface EventBuilder<TPayload> extends Buildable<EventEntity<TPayload>> {
  name(name: string): this
  payload(payload: TPayload): this
  volatile(): this
  durable(): this
}
