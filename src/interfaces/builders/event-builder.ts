import { Buildable } from './__internal__.js'
import { EventEntity } from '../entities/event-entity.js'

export interface EventBuilder<T extends string, P>
  extends Buildable<EventEntity<T, P>> {
  type(type: string): this

  payload(payload: P): this

  volatile(): this

  durable(): this
}
