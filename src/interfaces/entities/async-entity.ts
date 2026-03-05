import { Injector } from '../event-generator.js'
import { FlowEntity } from './flow-entity.js'

export interface AsyncEntity<TState> {
  factory: (use: Injector) => Promise<FlowEntity<TState>>
}
