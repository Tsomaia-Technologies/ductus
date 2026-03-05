import { InputEventStream } from './input-event-stream.js'
import { OutputEventStream } from './output-event-stream.js'
import { BaseEvent } from './event.js'

export type Type<T = any> = { new(...args: any[]): T }
export type Injector = <T extends { new(...args: any[]): any }>(type: T) => InstanceType<T>

export type EventGenerator<TState> = (
  events: InputEventStream,
  getState: () => TState,
  use: Injector,
) => OutputEventStream
