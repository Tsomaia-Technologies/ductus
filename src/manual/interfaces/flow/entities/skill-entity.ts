import { Schema } from '../../schema.js'

export interface SkillEntity {
  name: string
  input: {
    schema: Schema
    payload?: string
  }
  output: Schema
}
