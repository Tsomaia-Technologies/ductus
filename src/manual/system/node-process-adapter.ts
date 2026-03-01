import { SystemProcessAdapter, SystemProcessEvent } from '../interfaces/system-process-adapter.js'
import { spawn, ChildProcess } from 'node:child_process'
import { LinkedList } from '../core/linked-list.js'
import { CancellationToken, Disposer } from '../interfaces/cancellation-token.js'
import { clearTimeout } from 'node:timers'

export interface NodeProcessOptions {
  command: string
  args: string[]
  cwd: string
  timeoutMs?: number
  shutdownTimeoutMs?: number
  env?: Record<string, string>
  canceller?: CancellationToken
}

export class NodeProcessAdapter implements SystemProcessAdapter {
  private static DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000
  private readonly eventQueue = new LinkedList<SystemProcessEvent>()
  private readonly wakeUpResolvers = new LinkedList<() => void>()
  private _process: ChildProcess | null = null
  private isTerminationRequested = false
  private isTerminated = false
  private isWritePending = false
  private terminationTimeoutHandle: NodeJS.Timeout | null = null
  private dismissCancellationListener: Disposer | null = null
  private errors: Error[] = []

  constructor(private readonly options: NodeProcessOptions) {
  }

  async *readStream(): AsyncIterableIterator<SystemProcessEvent> {
    if (!this._process) {
      this._process = this.createProcess()
    }

    while (true) {
      if (this.errors.length > 0) {
        if (this.errors.length === 1) {
          throw this.errors[0]
        }

        throw new AggregateError(this.errors, `Process encountered errors mid-stream`)
      }

      const event = this.eventQueue.removeFirst()

      if (event) {
        yield event
      } else if (this.isTerminated) {
        return
      } else {
        await new Promise<void>((resolve) => {
          this.wakeUpResolvers.insertLast(resolve)
        })
      }
    }
  }

  async write(input: string): Promise<void> {
    if (this.isTerminationRequested || this.isTerminated) {
      throw new Error('Cannot write to terminated process')
    }

    if (this.isWritePending) {
      throw new Error('Cannot write, the previous write operation has not been resolved yet')
    }

    this.isWritePending = true

    await new Promise<void>((resolve, reject) => {
      const process = this.process

      if (!process.stdin) {
        throw new Error('Cannot write to process - broken stdin pipe')
      }

      process.stdin.write(input, (error) => {
        if (error) reject(error)
        else {
          this.isWritePending = false
          resolve()
        }
      })
    })
  }

  async gracefullyShutdown(drain = false): Promise<void> {
    if (this.requestTermination(drain)) {
      this.process.kill('SIGTERM')

      await new Promise<void>(resolve => {
        const timeout = this.options.shutdownTimeoutMs ?? NodeProcessAdapter.DEFAULT_SHUTDOWN_TIMEOUT_MS
        this.terminationTimeoutHandle = setTimeout(() => {
          this.process.kill('SIGKILL')
          resolve()
        }, timeout).unref()
      })
    }
  }

  kill(drain = false): void {
    if (this.requestTermination(drain)) {
      this.process.kill('SIGKILL')
    }
  }

  private requestTermination(drain: boolean) {
    if (this.isTerminationRequested || this.isTerminated) {
      return false
    }

    this.isTerminationRequested = true

    if (!drain) {
      this.eventQueue.clear()
    }

    return true
  }

  private pushEvent(event: SystemProcessEvent): void {
    this.eventQueue.insertLast(event)
    this.wakeUpNext()
  }

  private pushError(error: Error): void {
    this.errors.push(error)
    this.wakeUpNext()
  }

  private get process() {
    if (!this._process) {
      this._process = this.createProcess()
    }

    return this._process
  }

  private createProcess() {
    const { command, args, cwd, timeoutMs, env, canceller } = this.options

    const process = spawn(command, args, {
      cwd,
      env,
      timeout: timeoutMs,
    })

    if (canceller) {
      this.dismissCancellationListener = canceller?.onCancel(async force => {
        if (force) {
          this.kill(false)
        } else {
          await this.gracefullyShutdown(true)
        }
      })
    }

    this.bindEvents(process)

    return process
  }

  private bindEvents(process: ChildProcess) {
    process.stdout?.on('data', (data: Buffer) => {
      this.pushEvent({
        type: 'stdout',
        timestamp: Date.now(),
        content: data.toString('utf8'),
      })
    })
    process.stderr?.on('data', (data: Buffer) => {
      this.pushEvent({
        type: 'stderr',
        timestamp: Date.now(),
        content: data.toString('utf8'),
      })
    })
    process.on('close', (code, signal) => {
      this.wakeUpAll()

      if (this.terminationTimeoutHandle)
        clearTimeout(this.terminationTimeoutHandle)

      if (this.dismissCancellationListener)
        this.dismissCancellationListener()

      this.isTerminated = true

      if (code !== null && code !== 0) {
        this.pushError(new Error(`Process existed with code: ${code}`))
      } else {
        this.pushEvent({
          type: 'exit',
          timestamp: Date.now(),
          exitCode: code ?? 1,
          signal,
        })
      }
    })

    const handleStreamError = (error: Error) => {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError?.code !== 'EPIPE') this.errors.push(error)
    }

    process.on('error', (error: Error) => {
      this.errors.push(error)
    })
    process.stdout?.on('error', handleStreamError)
    process.stderr?.on('error', handleStreamError)
  }

  private wakeUpNext(): void {
    if (this.isTerminated) {
      return
    }

    const wakeUpResolver = this.wakeUpResolvers.removeFirst()

    if (wakeUpResolver) {
      wakeUpResolver()
    }
  }

  private wakeUpAll(): void {
    if (this.isTerminated) {
      return
    }

    let wakeUpResolver: (() => void) | null = null

    while (wakeUpResolver = this.wakeUpResolvers.removeFirst()) {
      wakeUpResolver()
    }
  }
}
