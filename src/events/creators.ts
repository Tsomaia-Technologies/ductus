import { BaseEvent } from '../interfaces/event.js'

export type EventParams<T extends string, P> = Omit<BaseEvent<T, P>, 'volatility' | 'isCommited'>

export function volatile<T extends string, P>(
  params: EventParams<T, P>,
): BaseEvent<T, P> {
  return {
    ...params,
    volatility: 'volatile',
  }
}

export function durable<T extends string, P>(
  params: EventParams<T, P>,
): BaseEvent<T, P> {
  return {
    ...params,
    volatility: 'durable',
  }
}

export function tick() {
  return volatile({
    type: 'tick',
    payload: undefined,
  })
}
