import { Schema } from '../schema.js'

export interface SkillEntity<T extends Schema = any, U extends Schema = any> {
  name: string
  input: {
    schema: T
    payload?: string
  }
  output: U
}
