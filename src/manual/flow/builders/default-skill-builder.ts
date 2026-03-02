import { SkillBuilder } from '../../interfaces/flow/builders/skill-builder.js'
import { Schema } from 'node:inspector'

export class DefaultSkillBuilder implements SkillBuilder {
  input(schema: Schema, template?: string): this {
  }
}
