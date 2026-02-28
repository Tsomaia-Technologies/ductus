import { CancellationToken } from './cancellation-token.js'
import { SystemProcessAdapter } from './system-process-adapter.js'

export interface SystemAdapter {
  /**
   * Returns a clone of the default environment variables passed to every command, unless overridden
   */
  getEnv(): Record<string, string>

  /**
   * Returns default working directory for commands and processes
   *
   * If it's null, then cwd() is determined dynamically based on the current context
   */
  getDefaultCwd(): string | null

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
   * @param {string} executable
   * @param {string[]} args
   * @param {SystemCommandOptions} options
   */
  spawn(
    executable: string,
    args: string[],
    options?: SystemCommandOptions,
  ): SystemProcessAdapter

  /**
   * Terminates all commands and processes being run by this adapter
   */
  terminate(): Promise<void>
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
   * Environment variables adding to and/or overriding default variables
   */
  env?: Record<string, string>

  /**
   * Cancellation token for the command
   */
  canceller?: CancellationToken
}

export interface SystemCommandResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
  cancelled: boolean
}
