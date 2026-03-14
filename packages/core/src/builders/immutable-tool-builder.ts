import { BUILD } from '../interfaces/builders/__internal__.js'
import { ToolBuilder } from '../interfaces/builders/tool-builder.js'
import { ToolEntity, ToolContext } from '../interfaces/entities/tool-entity.js'
import { Schema } from '../interfaces/schema.js'

interface ToolBuilderParams {
  name?: string
  description?: string
  inputSchema?: Schema
  execute?: (input: unknown, context: ToolContext) => Promise<unknown>
}

export class ImmutableToolBuilder<TInput = unknown, TOutput = unknown>
  implements ToolBuilder<TInput, TOutput> {

  constructor(private readonly params: ToolBuilderParams = {}) {}

  name(name: string): ToolBuilder<TInput, TOutput> {
    return this.clone<TInput, TOutput>({ name })
  }

  description(description: string): ToolBuilder<TInput, TOutput> {
    return this.clone<TInput, TOutput>({ description })
  }

  input<U>(schema: Schema): ToolBuilder<U, TOutput> {
    return this.clone<U, TOutput>({ inputSchema: schema })
  }

  execute<V>(
    fn: (input: TInput, context: ToolContext) => Promise<V>,
  ): ToolBuilder<TInput, V> {
    return this.clone<TInput, V>({ execute: fn as (input: unknown, context: ToolContext) => Promise<unknown> })
  }

  [BUILD](): ToolEntity<TInput, TOutput> {
    if (!this.params.name) throw new Error('Tool requires a name.')
    if (!this.params.description) throw new Error('Tool requires a description.')
    if (!this.params.inputSchema) throw new Error('Tool requires an input schema.')
    if (!this.params.execute) throw new Error('Tool requires an execute function.')

    return {
      name: this.params.name,
      description: this.params.description,
      inputSchema: this.params.inputSchema,
      execute: this.params.execute as ToolEntity<TInput, TOutput>['execute'],
    }
  }

  private clone<I, O>(updated: Partial<ToolBuilderParams>): ToolBuilder<I, O> {
    const Ctor = this.constructor as new (p?: ToolBuilderParams) => ImmutableToolBuilder<I, O>
    return new Ctor({ ...this.params, ...updated })
  }
}
