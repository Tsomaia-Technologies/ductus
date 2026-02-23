import type { Task } from '../../schema'
import type { PipelineContext, PipelineTaps, RunPhase } from '../context'
import { createPersistTap } from './persistence'

export interface InkTapsRef {
  current: {
    setPhase: (phase: RunPhase) => void
    appendStream: (chunk: string) => void
    setStreamActive: (active: boolean) => void
    setError: (err: string | null) => void
    setTasks: (tasks: Task[]) => void
    setCurrentTask: (index: number, taskId: string | null) => void
    setCurrentAttempt: (n: number) => void
    submitTaskApproval: (feedback: string | null) => void
  } | null
}

/**
 * Creates PipelineTaps that update the Ink UI via a ref to RunContext.
 * promptTaskApproval returns a promise resolved when the user submits in TaskReviewView.
 */
export function createInkTaps(ref: InkTapsRef): PipelineTaps {
  const persistTap = createPersistTap()

  return {
    setPhase(phase: RunPhase): void {
      ref.current?.setPhase(phase)
    },

    appendStream(chunk: string): void {
      ref.current?.appendStream(chunk)
    },

    setStreamActive(active: boolean): void {
      ref.current?.setStreamActive(active)
    },

    setError(err: string | null): void {
      ref.current?.setError(err)
    },

    persistTasks(ctx: PipelineContext): void {
      persistTap(ctx)
    },

    promptTaskApproval(tasks: Task[]): Promise<string | null> {
      ref.current?.setPhase('task-review')
      ref.current?.setTasks(tasks)
      return new Promise((resolve) => {
        const cur = ref.current as (typeof ref.current) & { _taskApprovalResolve?: (f: string | null) => void }
        if (!cur) {
          resolve(null)
          return
        }
        cur._taskApprovalResolve = resolve
      })
    },
    setCurrentTask: (index, taskId) => ref.current?.setCurrentTask(index, taskId),
    setTasks: (tasks) => ref.current?.setTasks(tasks),
  }
}
