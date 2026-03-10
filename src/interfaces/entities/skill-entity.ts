import { Schema } from '../schema.js'
import { ToolEntity } from './tool-entity.js'

export interface SkillAssertContext<TState = unknown> {
  use: <T>(token: string) => T
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
