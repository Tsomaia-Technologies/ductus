import { InputEventStream } from './input-event-stream.js'
import { OutputEventStream } from './output-event-stream.js'

export type Type<T = any> = { new(...args: any[]): T }

export interface InjectorOptions {
  optional?: boolean
}

export interface Injector {
  <T extends { new(...args: any[]): any }>(type: T): InstanceType<T>
  <T extends { new(...args: any[]): any }>(
    type: T,
    options: { optional: false },
  ): InstanceType<T>
  <T extends { new(...args: any[]): any }>(
    type: T,
    options: { optional: true },
  ): InstanceType<T> | undefined
}

export type EventGenerator<TState> = (
  events: InputEventStream,
  getState: () => TState,
  use: Injector,
) => OutputEventStream
