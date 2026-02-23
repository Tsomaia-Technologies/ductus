import type { Task, EngineerReport, Approval, Rejection } from '../schema.js'
import type { CommandResult } from '../verify.js'
import type { CheckProfile } from '../ductus-config.js'

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
 * Optional context passed when an error occurs; helps ErrorView show where the pipeline failed.
 */
export interface ErrorContext {
  taskId?: string | null
  taskIndex?: number
  attempt?: number
}

/**
 * Side-effect interface for pipeline stages.
 * All functions are required; use createDefaultTaps() for no-op implementations.
 * Taps perform I/O and UI updates without altering core flow.
 */
export interface PipelineTaps {
  setPhase: (phase: RunPhase) => void
  appendStream: (chunk: string) => void
  setStreamActive: (active: boolean) => void
  setError: (err: string | null, context?: ErrorContext) => void
  persistTasks: (ctx: PipelineContext) => void
  /** Prompts user to accept tasks or provide feedback. Returns null if accepted, feedback string otherwise. */
  promptTaskApproval: (tasks: Task[]) => Promise<string | null>
  /** Optional: updates UI with current task (for Ink). */
  setCurrentTask?: (index: number, taskId: string | null) => void
  /** Optional: updates UI with task list (for Ink). */
  setTasks?: (tasks: Task[]) => void
}

/**
 * Immutable configuration passed at pipeline initialization.
 * Never modified during execution.
 */
export interface PipelineConfig {
  cwd: string
  feature: string
  planPath: string
  planContent: string
  maxRetries: number
  retryFailed: boolean
  forceAddIgnored?: boolean
  checks: CheckProfile[]
  agentPath: string
  plainMode?: boolean
}

/**
 * Volatile execution state; updated by stages as the pipeline runs.
 */
export interface PipelineState {
  tasks: Task[]
  taskStatus: Record<string, 'pending' | 'completed' | 'failed'>
  sortedTaskIds: string[]
  currentTaskId: string | null
  currentAttempt: number
  engineerReport: EngineerReport | null
  lastReviewResult: Approval | Rejection | null
  headRefBeforeTask: string | null
  diff: string | null
  commandResults: CommandResult[] | null
  /** Populated by pipe when a stage throws; allows UI to react before process exits. */
  lastError: string | null
  /** Git ref after last committed task; used to revert when retrying a failed task. */
  lastCompletedRef: string | null
  /** Whether we resumed from existing tasks; skips architect refine loop. */
  isResume: boolean
}

/**
 * Full pipeline context: config (immutable) + state (volatile) + taps (side-effect handlers).
 */
export interface PipelineContext {
  config: PipelineConfig
  state: PipelineState
  taps: PipelineTaps
}

/**
 * A stage receives context and returns updated context.
 */
export type PipelineStage = (
  ctx: PipelineContext,
) => Promise<PipelineContext>

/**
 * Returns no-op implementations for all taps.
 * Stages can call taps without null-checks; the logic remains clean and predictable.
 */
export function createDefaultTaps(): PipelineTaps {
  return {
    setPhase: () => {},
    appendStream: () => {},
    setStreamActive: () => {},
    setError: () => {},
    persistTasks: () => {},
    promptTaskApproval: async () => null, // No-op: always accept (for tests)
    setCurrentTask: undefined,
    setTasks: undefined,
  }
}
