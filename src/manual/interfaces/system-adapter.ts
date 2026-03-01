import { CancellationToken } from './cancellation-token.js'
import { SystemProcessAdapter } from './system-process-adapter.js'

export interface SystemAdapter {
  /**
   * Returns a clone of the default environment variables passed to every command, unless overridden
   */
  getDefaultEnv(): Record<string, string | undefined>

  /**
   * Returns default working directory for commands and processes
   *
   * If it's null, then cwd() is determined dynamically based on the current context
   */
  getDefaultCwd(): string | null

  /**
   * Returns default max buffer
   */
  getDefaultMaxBuffer(): number

  /**
   * Resolves absolute path based on the given segments and the current default cwd (@see {getDefaultCwd()}).
   *
   * @param {string[]}segments
   */
  resolveAbsolutePath(...segments: string[]): string

  /**
   * Executes a command with the given arguments and options
   *
   * @param {string} command
   * @param {string[]} args
   * @param {SystemCommandOptions} options
   */
  execute(
    command: string,
    args: string[],
    options?: SystemCommandOptions,
  ): Promise<SystemCommandResult>

  /**
   * Spawns an executable process with the given arguments and options
   *
   * @param {string} command
   * @param {string[]} args
   * @param {SystemProcessOptions} options
   */
  spawn(
    command: string,
    args: string[],
    options?: SystemProcessOptions,
  ): SystemProcessAdapter

  /**
   * Terminates all commands and processes being run by this adapter
   */
  terminate(params?: { force?: boolean }): Promise<void>
}

export interface SystemCommandOptions {
  /**
   * Current working directory for the command/process
   */
  cwd?: string

  /**
   * The maximum allowed execution time in milliseconds
   */
  timeoutMs?: number

  /**
   * Max buffer size
   */
  maxBuffer?: number

  /**
   * Environment variables adding to and/or overriding default variables
   */
  env?: Record<string, string>

  /**
   * Cancellation token for the command
   */
  canceller?: CancellationToken
}

export interface SystemProcessOptions extends Omit<SystemCommandOptions, 'maxBuffer'> {
  /**
   * The maximum allowed graceful shutdown time in milliseconds
   */
  shutdownTimeoutMs?: number
}

export interface SystemCommandResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
  cancelled: boolean
}
