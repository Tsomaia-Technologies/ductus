import { event } from '../utils/event-utils.js'
import { number } from '../utils/schema-utils.js'

export const BootEvent = event('Ductus/BootEvent', {
  timestamp: number(),
})
