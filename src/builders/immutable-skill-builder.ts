import { BUILD } from '../interfaces/builders/__internal__.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { Schema } from '../interfaces/schema.js'
import { Infer } from '../interfaces/event.js'

interface SkillBuilderParams {
  name?: string
  inputSchema?: Schema
  inputTemplate?: string
  outputSchema?: Schema
}

export class ImmutableSkillBuilder<T = any, U = any> implements SkillBuilder<T, U> {
  constructor(private readonly params: SkillBuilderParams = {}) {
  }

  name(name: string) {
    return this.clone({ name })
  }

  input<I extends Schema>(schema: I, template?: string) {
    return this.clone<I, U>({
      inputSchema: schema,
      inputTemplate: template,
    })
  }

  output<O extends Schema>(schema: O) {
    return this.clone<T, Infer<O>>({ outputSchema: schema })
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

  private clone<T, U>(params: Partial<SkillBuilderParams>): SkillBuilder<T, U> {
    const Constructor = this.constructor as new (params?: SkillBuilderParams) => ImmutableSkillBuilder<T, U>
    const clone = new Constructor({ ...this.params, ...params })
    return clone
  }
}
