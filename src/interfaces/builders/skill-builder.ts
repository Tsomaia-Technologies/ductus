import { Schema } from '../schema.js'
import { Buildable } from './__internal__.js'
import { SkillEntity } from '../entities/skill-entity.js'
import { Infer } from '../event.js'

export interface SkillBuilder<T = unknown> extends Buildable<SkillEntity> {
  name(name: string): SkillBuilder<T>

  input(schema: Schema, template?: string): SkillBuilder<T>

  output<TOutput extends Schema>(schema: TOutput): SkillBuilder<Infer<TOutput>>
}
