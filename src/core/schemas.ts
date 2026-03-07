import * as D from '../utils/schema-utils.js'
import * as z from 'zod/v3'

export const BaseEventSchema = D.looseObject({
  type: D.string(),
  volatility: D._enum(['durable', 'volatile', 'intent']),
  payload: D.object({}),
})

type A = z.infer<typeof BaseEventSchema>

const a = {
  type: 'asd',
  volatility: 'volatile' as const,
  payload: {
    a: '1',
  }
}

export function b(a: A) {
  
}

b(a)
