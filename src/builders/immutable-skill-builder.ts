import { BUILD } from '../interfaces/builders/__internal__.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { Schema } from '../interfaces/schema.js'

interface SkillBuilderParams {
  name?: string
  inputSchema?: Schema
  inputTemplate?: string
  outputSchema?: Schema
}

export class ImmutableSkillBuilder implements SkillBuilder {
  private params: SkillBuilderParams

  constructor() {
    this.params = {}
  }

  name(name: string): this {
    return this.clone({ name })
  }

  input(schema: Schema, template?: string): this {
    return this.clone({
      inputSchema: schema,
      inputTemplate: template,
    })
  }

  output(schema: Schema): this {
    return this.clone({ outputSchema: schema })
  }

  [BUILD](): SkillEntity {
    if (!this.params.name) throw new Error('Skill requires a name.')
    if (!this.params.inputSchema) throw new Error('Skill requires an input schema.')
    if (!this.params.outputSchema) throw new Error('Skill requires an output schema.')

    return {
      name: this.params.name,
      input: {
        schema: this.params.inputSchema,
        payload: this.params.inputTemplate,
      },
      output: this.params.outputSchema,
    }
  }

  private clone(params: Partial<SkillBuilderParams>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
