import { Schema } from '../schema.js'
import { BaseEvent } from '../event.js'

export interface ToolContext<TState = unknown> {
  getState: () => TState
  use: <T>(token: string) => T
  emit: (event: BaseEvent) => void
}

export interface ToolEntity<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema: Schema
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>
}
