import { DeeplyReadonly } from '../interfaces/helpers.js'
import { BaseEvent } from '../interfaces/event.js'

export function freezeEvent<T extends BaseEvent>(event: T): DeeplyReadonly<T> {
  Object.freeze(event)
  if (typeof event === 'object'
    && event !== null
    && 'payload' in event
    && typeof event.payload === 'object'
    && event.payload !== null)
    Object.freeze(event.payload)

  return event as unknown as DeeplyReadonly<T>
}
