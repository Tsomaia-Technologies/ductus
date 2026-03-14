import { Schema } from '../schema.js'
import { BaseEvent } from '../event.js'
import { Injectable, InferInjectable } from '../event-generator.js'

export interface ToolContext<TState = unknown> {
  getState: () => TState
  use: <T extends Injectable>(token: T) => InferInjectable<T>
  emit: (event: BaseEvent) => void
}

export interface ToolEntity<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema: Schema
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>
}
