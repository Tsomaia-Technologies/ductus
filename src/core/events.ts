import { event } from '../utils/event-utils.js'
import { number } from 'ductus'

export const BootEvent = event('Ductus/BootEvent', {
  timestamp: number(),
})
