import { Schema } from '../schema.js'
import { BaseEvent } from '../event.js'
import { Injector } from '../event-generator.js'

export interface ToolContext<TState = unknown> {
  getState: () => TState
  use: Injector
  emit: (event: BaseEvent) => void
}

export interface ToolEntity<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema: Schema
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>
}
