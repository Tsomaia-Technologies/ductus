import { AdapterBuilder } from './adapter-builder.js'

export interface CliAdapterBuilder extends AdapterBuilder {
    apiKey(apiKey: string): this
    cwd(cwd: string): this
    env(key: string, value: string | undefined): this
    env(vars: Record<string, string | undefined>): this
    timeoutMs(timeoutMs: number): this
    command(command: string): this
    args(...args: string[]): this
}
