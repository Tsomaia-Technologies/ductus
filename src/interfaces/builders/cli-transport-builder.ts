import { Buildable } from './__internal__.js'
import { TransportEntity } from '../entities/transport-entity.js'

export interface CliTransportBuilder extends Buildable<TransportEntity> {
  apiKey(apiKey: string): this
  cwd(cwd: string): this
  env(key: string, value: string | undefined): this
  env(vars: Record<string, string | undefined>): this
  timeoutMs(timeoutMs: number): this
  command(command: string): this
  args(...args: string[]): this
}
