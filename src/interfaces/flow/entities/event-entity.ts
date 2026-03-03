import { BaseEvent } from '../../event.js'

export interface EventEntity<T extends string, P> extends BaseEvent<T, P> {
}
