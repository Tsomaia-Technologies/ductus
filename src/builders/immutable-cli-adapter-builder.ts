import { BUILD } from '../interfaces/builders/__internal__.js'
import { CliAdapterBuilder } from '../interfaces/builders/cli-adapter-builder.js'
import { AdapterEntity } from '../interfaces/entities/adapter-entity.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { CliAgentAdapter } from '../adapters/cli-agent-adapter.js'

interface CliAdapterBuilderParams {
  apiKey?: string
  cwd?: string
  readonly env: Record<string, string | undefined>
  timeoutMs?: number
  command?: string
  readonly args: string[]
}

export class ImmutableCliAdapterBuilder implements CliAdapterBuilder {
  private params: CliAdapterBuilderParams

  constructor() {
    this.params = {
      env: {},
      args: [],
    }
  }

  apiKey(apiKey: string): this {
    return this.clone({ apiKey })
  }

  cwd(cwd: string): this {
    return this.clone({ cwd })
  }

  env(key: string, value: string | undefined): this
  env(vars: Record<string, string | undefined>): this
  env(
    keyOrVars: string | Record<string, string | undefined>,
    value?: string | undefined,
  ): this {
    if (typeof keyOrVars === 'string') {
      return this.clone({
        env: { ...this.params.env, [keyOrVars]: value }
      })
    }
    return this.clone({
      env: { ...this.params.env, ...keyOrVars }
    })
  }

  timeoutMs(timeoutMs: number): this {
    return this.clone({ timeoutMs })
  }

  command(command: string): this {
    return this.clone({ command })
  }

  args(...args: string[]): this {
    return this.clone({ args: [...args] })
  }

  [BUILD](): AdapterEntity {
    if (!this.params.command) {
      throw new Error('CLI adapter requires a command.')
    }

    const config = {
      command: this.params.command,
      args: [...this.params.args],
      cwd: this.params.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ...this.params.env,
        ...(this.params.apiKey ? { API_KEY: this.params.apiKey } : {}),
      },
      timeoutMs: this.params.timeoutMs,
    }

    return {
      create(_agent: AgentEntity, _model: ModelEntity) {
        return new CliAgentAdapter(config)
      },
    }
  }

  private clone(params: Partial<CliAdapterBuilderParams>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
