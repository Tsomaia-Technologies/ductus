import { BUILD } from '../interfaces/builders/__internal__.js'
import { CliAdapterBuilder } from '../interfaces/builders/cli-adapter-builder.js'
import { AdapterEntity } from '../interfaces/entities/adapter-entity.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { CliAgentAdapter } from '../adapters/cli-agent-adapter.js'

export class DefaultCliAdapterBuilder implements CliAdapterBuilder {
    private _apiKey?: string
    private _cwd?: string
    private readonly _env: Record<string, string | undefined> = {}
    private _timeoutMs?: number
    private _command?: string
    private readonly _args: string[] = []

    apiKey(apiKey: string): this {
        this._apiKey = apiKey
        return this
    }

    cwd(cwd: string): this {
        this._cwd = cwd
        return this
    }

    env(key: string, value: string | undefined): this
    env(vars: Record<string, string | undefined>): this
    env(
        keyOrVars: string | Record<string, string | undefined>,
        value?: string | undefined,
    ): this {
        if (typeof keyOrVars === 'string') {
            this._env[keyOrVars] = value
        } else {
            Object.assign(this._env, keyOrVars)
        }
        return this
    }

    timeoutMs(timeoutMs: number): this {
        this._timeoutMs = timeoutMs
        return this
    }

    command(command: string): this {
        this._command = command
        return this
    }

    args(...args: string[]): this {
        this._args.length = 0
        this._args.push(...args)
        return this
    }

    [BUILD](): AdapterEntity {
        if (!this._command) {
            throw new Error('CLI adapter requires a command.')
        }

        const config = {
            command: this._command,
            args: [...this._args],
            cwd: this._cwd ?? process.cwd(),
            env: {
                ...process.env,
                ...this._env,
                ...(this._apiKey ? { API_KEY: this._apiKey } : {}),
            },
            timeoutMs: this._timeoutMs,
        }

        return {
            create(_agent: AgentEntity, _model: ModelEntity) {
                return new CliAgentAdapter(config)
            },
        }
    }
}
