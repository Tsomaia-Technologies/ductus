import { AdapterBuilder } from './adapter-builder.js'
import { ModelEntity } from '../entities/model-entity.js'

export type DynamicCommand = (model: ModelEntity) => string

export interface CliAdapterBuilder extends AdapterBuilder {
  apiKey(apiKey: string): this

  cwd(cwd: string): this

  env(key: string, value: string | undefined): this

  env(vars: Record<string, string | undefined>): this

  timeoutMs(timeoutMs: number): this

  command(command: string | DynamicCommand): this

  args(...args: string[]): this
}
