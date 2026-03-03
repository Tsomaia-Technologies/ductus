import { Schema } from '../../schema.js'
import { Buildable } from './__internal__.js'
import { SkillEntity } from '../entities/skill-entity.js'

export interface SkillBuilder extends Buildable<SkillEntity> {
  input(schema: Schema, template?: string): this
  output(schema: Schema): this
}
