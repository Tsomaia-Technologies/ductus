import { BUILD } from '../interfaces/builders/__internal__.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { Schema } from '../interfaces/schema.js'

export class DefaultSkillBuilder implements SkillBuilder {

  private _name?: string
  private _inputSchema?: Schema
  private _inputTemplate?: string
  private _outputSchema?: Schema

  name(name: string): this {
    this._name = name
    return this
  }

  input(schema: Schema, template?: string): this {
    this._inputSchema = schema
    this._inputTemplate = template
    return this
  }

  output(schema: Schema): this {
    this._outputSchema = schema
    return this
  }

  [BUILD](): SkillEntity {
    if (!this._name) throw new Error('Skill requires a name.')
    if (!this._inputSchema) throw new Error('Skill requires an input schema.')
    if (!this._outputSchema) throw new Error('Skill requires an output schema.')

    return {
      name: this._name,
      input: {
        schema: this._inputSchema,
        payload: this._inputTemplate,
      },
      output: this._outputSchema,
    }
  }
}
