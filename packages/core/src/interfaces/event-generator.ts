import { InputEventStream } from './input-event-stream.js'
import { OutputEventStream } from './output-event-stream.js'

export type Type<T = any> = { new(...args: any[]): T }

export interface Token<T> {
  readonly symbol: symbol
}

export function Token<T>(description?: string): Token<T> {
  return { symbol: Symbol(description) }
}

export type Injectable<T = any> = Type<T> | Token<T>

export type InferInjectable<T> = T extends Type<infer U> ? U : T extends Token<infer U> ? U : never

export interface InjectorOptions {
  optional?: boolean
}

export interface Injector {
  <T extends Injectable>(type: T): InferInjectable<T>
  <T extends Injectable>(
    type: T,
    options: { optional: false },
  ): InferInjectable<T>
  <T extends Injectable>(
    type: T,
    options: { optional: true },
  ): InferInjectable<T> | undefined
}

export type EventGenerator<TState> = (
  events: InputEventStream,
  getState: () => TState,
  use: Injector,
) => OutputEventStream
