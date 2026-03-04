import * as cp from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  SystemAdapter,
  SystemCommandOptions,
  SystemCommandResult,
  SystemProcessOptions,
} from '../interfaces/system-adapter.js'
import { SystemProcessAdapter } from '../interfaces/system-process-adapter.js'
import { NodeProcessAdapter } from './node-process-adapter.js'
import { Canceller } from './canceller.js'

export interface NodeSystemAdapterOptions {
  defaultEnv?: Record<string, string>
  defaultCwd?: string
  defaultMaxBuffer?: number
}

const execFile = promisify(cp.execFile)

export class NodeSystemAdapter implements SystemAdapter {
  static DEFAULT_MAX_BUFFER = 1024 * 1024 * 10

  private readonly defaultEnv: Record<string, string | undefined>
  private readonly defaultCwd: string
  private readonly defaultMaxBuffer: number
  private readonly activeProcesses = new Set<SystemProcessAdapter>()
  private readonly baseCanceller = new Canceller({ forceByDefault: true })

  constructor(options: NodeSystemAdapterOptions = {}) {
    const {
      defaultEnv = process.env,
      defaultCwd = process.cwd(),
      defaultMaxBuffer = NodeSystemAdapter.DEFAULT_MAX_BUFFER,
    } = options
    this.defaultEnv = defaultEnv
    this.defaultCwd = defaultCwd
    this.defaultMaxBuffer = defaultMaxBuffer
  }

  getDefaultEnv() {
    return { ...this.defaultEnv }
  }

  getDefaultCwd() {
    return this.defaultCwd
  }

  getDefaultMaxBuffer() {
    return this.defaultMaxBuffer
  }

  resolveAbsolutePath(...segments: string[]): string {
    return path.join(this.defaultCwd, ...segments)
  }

  async execute(
    command: string,
    args: string[],
    options: SystemCommandOptions = {},
  ): Promise<SystemCommandResult> {
    const { env = {}, timeoutMs, canceller: providedCanceller, maxBuffer } = options
    const resolvedEnv = { ...this.defaultEnv, ...env }
    const cwd = options.cwd || this.defaultCwd
    const canceller = new AbortController()

    const disposeProvidedCancellerListener =
      providedCanceller?.onCancel(() => canceller.abort())

    const disposeBaseCancellerListener =
      this.baseCanceller.onCancel(() => canceller.abort())

    try {
      const { stdout, stderr } = await execFile(command, args, {
        cwd,
        env: resolvedEnv,
        timeout: timeoutMs,
        signal: canceller.signal,
        maxBuffer: maxBuffer ?? this.defaultMaxBuffer,
      })

      return {
        stdout,
        stderr,
        exitCode: 0,
        timedOut: false,
        cancelled: false,
      }
    } catch (error: any) {
      const isCancelled = canceller.signal.aborted || error?.name === 'AbortError'
      const isTimedOut = error?.code === 'ETIMEDOUT' || (!!timeoutMs && error?.signal === 'SIGTERM')

      return {
        stdout: error?.stdout ?? '',
        stderr: error?.stderr ?? '',
        exitCode: error?.code ?? 1,
        timedOut: isTimedOut,
        cancelled: isCancelled,
      }
    } finally {
      disposeProvidedCancellerListener?.()
      disposeBaseCancellerListener?.()
    }
  }

  spawn(
    command: string,
    args: string[],
    options: SystemProcessOptions = {},
  ): SystemProcessAdapter {
    const {
      env = {},
      timeoutMs,
      shutdownTimeoutMs,
      canceller: providedCanceller,
    } = options
    const resolvedEnv = { ...this.defaultEnv, ...env }
    const cwd = options.cwd || this.defaultCwd
    const internalCanceller = new Canceller({ forceByDefault: true })
    const disposeProvidedCancellerListener =
      providedCanceller?.onCancel(force => internalCanceller.cancel({ force }))
    const disposeBaseCancellationListener =
      this.baseCanceller.onCancel(force => internalCanceller.cancel({ force }))

    const process = new NodeProcessAdapter({
      command,
      args,
      cwd,
      timeoutMs,
      shutdownTimeoutMs,
      env: resolvedEnv,
      canceller: internalCanceller,
    })

    this.activeProcesses.add(process)

    process.onTerminated(() => {
      this.activeProcesses.delete(process)
      disposeBaseCancellationListener()
      disposeProvidedCancellerListener?.()
    })

    return process
  }

  async terminate({ force }: { force?: boolean } = {}): Promise<void> {
    const terminationPromises = Array.from(this.activeProcesses).map(process => {
      return new Promise<void>(resolve => process.onTerminated(resolve))
    })

    this.baseCanceller.cancel({ force })

    await Promise.all(terminationPromises)
  }
}
