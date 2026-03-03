import { BUILD } from '../interfaces/builders/__internal__.js'
import { CliTransportBuilder } from '../interfaces/builders/cli-transport-builder.js'
import { TransportEntity } from '../interfaces/entities/transport-entity.js'
import { CliTransport } from '../entities/cli-transport.js'

export class DefaultCliTransportBuilder implements CliTransportBuilder {
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

    [BUILD](): TransportEntity {
        if (!this._command) {
            throw new Error('CLI transport requires a command.')
        }

        const mergedEnv: Record<string, string | undefined> = {
            ...process.env,
            ...this._env,
            ...(this._apiKey ? { API_KEY: this._apiKey } : {}),
        }

        return new CliTransport({
            command: this._command,
            args: [...this._args],
            cwd: this._cwd ?? process.cwd(),
            env: mergedEnv,
            timeoutMs: this._timeoutMs,
        })
    }
}
