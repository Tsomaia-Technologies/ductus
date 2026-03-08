import { Schema } from '../schema.js'
import { Buildable } from './__internal__.js'
import { SkillEntity } from '../entities/skill-entity.js'

export interface SkillBuilder<T extends Schema = any, U extends Schema = any>
  extends Buildable<SkillEntity<T, U>> {
  name(name: string): SkillBuilder<T, U>

  input<TInput extends Schema>(schema: TInput, template?: string): SkillBuilder<TInput, U>

  output<TOutput extends Schema>(schema: TOutput): SkillBuilder<T, TOutput>
}
