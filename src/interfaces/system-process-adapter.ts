export interface SystemProcessAdapter {
  readStream(): AsyncIterable<SystemProcessEvent>

  write(input: string): Promise<void>

  /**
   * Lets the process finalize its current work and shutdown, using SIGTERM.
   * If the process does not finish after certain period of time (up to the implementations),
   * Then gets killed using SIGKILL.
   *
   * If params.drain is true - then existing accumulated events are going to be emmited first,
   * but new events won't be received.
   *
   * If params.drain is false - new events will not be received as well, but existing events will be discarded too.
   *
   * @param params
   */
  gracefullyShutdown(params?: { drain?: boolean }): Promise<void>

  /**
   * Kills the process using SIGKILL. Forceful shutdown.
   *
   * Event thought this is nuclear operation,
   * the method still accepts "drain" parameter.
   *
   * If params.drain true - it lets the process emit existing events in case there is a short window between the
   * a kill(true) call and actual termination of the process.
   *
   * If params.drain is false - all existing events are immediately discarded.
   *
   * @param params
   */
  kill(params?: { drain?: boolean }): void

  /**
   * Registers callback that gets invoked when the process terminated is requested
   *
   * @param callback
   */
  onTerminationRequested(callback: () => void): void

  /**
   * Registers callback that gets invoked when the process is terminated
   *
   * @param callback
   */
  onTerminated(callback: () => void): void
}

export interface SystemProcessBaseEvent {
  type: string
  timestamp: number
}

export interface SystemProcessStdoutEvent extends SystemProcessBaseEvent {
  type: 'stdout'
  content: string
}

export interface SystemProcessStderrEvent extends SystemProcessBaseEvent {
  type: 'stderr'
  content: string
}

export interface SystemProcessExitEvent extends SystemProcessBaseEvent {
  type: 'exit'
  exitCode: number
  signal: string | null
}

export type SystemProcessEvent =
  | SystemProcessStdoutEvent
  | SystemProcessStderrEvent
  | SystemProcessExitEvent
