import { Schema } from '../schema.js'
import { Injectable, InferInjectable } from '../event-generator.js'
import { ToolEntity } from './tool-entity.js'

export interface SkillAssertContext<TState = unknown> {
  use: <T extends Injectable>(token: T) => InferInjectable<T>
  getState: () => TState
}

export interface SkillEntity {
  name: string
  input: {
    schema: Schema
    payload?: string
  }
  output: Schema
  assert?: (output: unknown, context: SkillAssertContext) => void | Promise<void>
  maxRetries?: number
  tools?: ToolEntity[]
}
