import { Schema } from '../schema.js'
import { Buildable } from './__internal__.js'
import { SkillEntity } from '../entities/skill-entity.js'
import { Infer } from '../event.js'

export interface SkillBuilder<T = any, U = any> extends Buildable<SkillEntity> {
  name(name: string): SkillBuilder<T, U>

  input<TInput extends Schema>(schema: TInput, template?: string): SkillBuilder<TInput, U>

  output<TOutput>(schema: TOutput): SkillBuilder<T, Infer<TOutput>>
}
