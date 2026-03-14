import { Schema } from '../schema.js'
import { Buildable } from './__internal__.js'
import { SkillEntity, SkillAssertContext } from '../entities/skill-entity.js'
import { Infer } from '../event.js'
import { ToolBuilder } from './tool-builder.js'
import { ToolEntity } from '../entities/tool-entity.js'

export interface SkillBuilder<T = unknown> extends Buildable<SkillEntity> {
  name(name: string): SkillBuilder<T>

  input(schema: Schema, template?: string): SkillBuilder<T>

  output<U extends Schema>(schema: U): SkillBuilder<Infer<U>>

  assert(
    fn: (output: T, context: SkillAssertContext) => void | Promise<void>,
  ): SkillBuilder<T>

  maxRetries(count: number): SkillBuilder<T>

  tool(tool: ToolBuilder | ToolEntity): SkillBuilder<T>
}
