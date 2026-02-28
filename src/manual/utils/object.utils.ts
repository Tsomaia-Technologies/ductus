import { DuctusEvent } from '../events/types.js'
import { DeeplyReadonly } from '../interfaces/helpers.js'

export function freezeEvent<T extends DuctusEvent>(event: T): DeeplyReadonly<T> {
  Object.freeze(event)
  if (typeof event.payload === 'object' && event.payload !== null)
    Object.freeze(event.payload)

  return event as unknown as DeeplyReadonly<T>
}
