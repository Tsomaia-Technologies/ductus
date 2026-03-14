import { BUILD, isBuildable, build } from '../interfaces/builders/__internal__.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'
import { SkillEntity, SkillAssertContext } from '../interfaces/entities/skill-entity.js'
import { ToolEntity } from '../interfaces/entities/tool-entity.js'
import { Schema } from '../interfaces/schema.js'
import { Infer } from '../interfaces/event.js'

interface SkillBuilderParams {
  name?: string
  inputSchema?: Schema
  inputTemplate?: string
  outputSchema?: Schema
  assert?: (output: unknown, context: SkillAssertContext) => void | Promise<void>
  maxRetries?: number
  tools?: ToolEntity[]
}

export class ImmutableSkillBuilder<T = unknown> implements SkillBuilder<T> {
  constructor(private readonly params: SkillBuilderParams = {}) {
  }

  name(name: string): SkillBuilder<T> {
    return this.clone<T>({ name })
  }

  input(schema: Schema, template?: string): SkillBuilder<T> {
    return this.clone<T>({
      inputSchema: schema,
      inputTemplate: template,
    })
  }

  output<U extends Schema>(schema: U): SkillBuilder<Infer<U>> {
    return this.clone<Infer<U>>({ outputSchema: schema })
  }

  assert(
    fn: (output: T, context: SkillAssertContext) => void | Promise<void>,
  ): SkillBuilder<T> {
    return this.clone<T>({
      assert: fn as (output: unknown, context: SkillAssertContext) => void | Promise<void>,
    })
  }

  maxRetries(count: number): SkillBuilder<T> {
    return this.clone<T>({ maxRetries: count })
  }

  tool(tool: ToolEntity | { [BUILD]: () => ToolEntity }): SkillBuilder<T> {
    const resolved: ToolEntity = isBuildable(tool) ? build(tool) : tool
    return this.clone<T>({
      tools: [...(this.params.tools ?? []), resolved],
    })
  }

  [BUILD](): SkillEntity {
    if (!this.params.name) throw new Error('Skill requires a name.')
    if (!this.params.inputSchema) throw new Error('Skill requires an input schema.')
    if (!this.params.outputSchema) throw new Error('Skill requires an output schema.')
    if (this.params.maxRetries !== undefined && this.params.maxRetries < 0) {
      throw new Error('maxRetries must be >= 0.')
    }

    const entity: SkillEntity = {
      name: this.params.name,
      input: {
        schema: this.params.inputSchema,
        payload: this.params.inputTemplate,
      },
      output: this.params.outputSchema,
    }

    if (this.params.assert) entity.assert = this.params.assert
    if (this.params.maxRetries !== undefined) entity.maxRetries = this.params.maxRetries
    if (this.params.tools?.length) entity.tools = this.params.tools

    return entity
  }

  private clone<U>(params: Partial<SkillBuilderParams>): SkillBuilder<U> {
    const Constructor = this.constructor as new (params?: SkillBuilderParams) => ImmutableSkillBuilder<U>

    return new Constructor({ ...this.params, ...params })
  }
}
