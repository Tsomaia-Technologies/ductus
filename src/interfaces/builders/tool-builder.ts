import { Buildable } from './__internal__.js'
import { ToolEntity, ToolContext } from '../entities/tool-entity.js'
import { Schema } from '../schema.js'

export interface ToolBuilder<TInput = unknown, TOutput = unknown> extends Buildable<ToolEntity<TInput, TOutput>> {
  name(name: string): ToolBuilder<TInput, TOutput>

  description(description: string): ToolBuilder<TInput, TOutput>

  input<U>(schema: Schema): ToolBuilder<U, TOutput>

  execute<V>(
    fn: (input: TInput, context: ToolContext) => Promise<V>,
  ): ToolBuilder<TInput, V>
}
