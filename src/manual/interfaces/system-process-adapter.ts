export interface SystemProcessAdapter {
  readStream(): AsyncIterable<SystemProcessEvent>

  write(input: string): Promise<void>

  gracefullyShutdown(drain?: boolean): Promise<void>

  kill(drain?: boolean): void
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
