import { DeeplyReadonly } from '../interfaces/helpers.js'

export function freezeEvent<TEvent>(event: TEvent): DeeplyReadonly<TEvent> {
  Object.freeze(event)
  if (typeof event === 'object'
    && event !== null
    && 'payload' in event
    && typeof event.payload === 'object'
    && event.payload !== null)
    Object.freeze(event.payload)

  return event as unknown as DeeplyReadonly<TEvent>
}
