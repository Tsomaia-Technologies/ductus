export interface EventEntity<TPayload> {
  name: string
  payload: TPayload
  volatility: 'durable' | 'volatile'
}
