import type { Task, EngineerReport, Approval, Rejection } from '../schema'
import type { CommandResult } from '../verify'

/**
 * Phase of the orchestration run; used by UI taps to update the display.
 */
export type RunPhase =
  | 'architect'
  | 'task-review'
  | 'refinement'
  | 'engineer'
  | 'reviewer'
  | 'remediation'
  | 'commit-prompt'
  | 'complete'
  | 'error'

/**
 * Side-effect interface for pipeline stages.
 * Taps perform I/O and UI updates without altering core flow.
 */
export interface PipelineTaps {
  setPhase: (phase: RunPhase) => void
  appendStream: (chunk: string) => void
  setStreamActive: (active: boolean) => void
  setError: (err: string | null) => void
  persistTasks: (ctx: PipelineContext) => void
}

/**
 * Unified state object that flows through the entire pipeline.
 */
export interface PipelineContext {
  /** Input metadata */
  cwd: string
  feature: string
  planPath: string
  planContent: string
  maxRetries: number
  retryFailed: boolean

  /** Tasks and state recovery */
  tasks: Task[]
  taskStatus: Record<string, 'pending' | 'completed' | 'failed'>
  sortedTaskIds: string[]

  /** Current execution cursor */
  currentTaskId: string | null
  currentAttempt: number
  engineerReport: EngineerReport | null
  lastReviewResult: Approval | Rejection | null

  /** Git state */
  headRefBeforeTask: string | null
  diff: string | null

  /** Verification results (run by tool before Reviewer) */
  commandResults: CommandResult[] | null

  /** Side-effect interface */
  taps: PipelineTaps
}
