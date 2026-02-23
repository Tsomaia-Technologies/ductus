import * as path from 'path'
import type { PipelineContext, PipelineStage } from '../context'
import { refinePlanToTasks } from '../../lambdas/refinePlanToTasks'
import { promptForTaskApproval } from '../../prompt-user'

const MAX_REFINEMENT_FAILURES = 3

/**
 * Task-review loop: prompt user to accept or refine tasks. Skips if isResume.
 */
export const architectStage: PipelineStage = async (ctx: PipelineContext) => {
  const { config, state, taps } = ctx
  if (state.isResume) {
    return ctx
  }
  if (state.tasks.length === 0) {
    return ctx
  }

  const { cwd, feature, planContent } = config
  const tasksPath = path.resolve(cwd, '.ductus', feature, 'tasks.json')
  let tasks = state.tasks
  let taskStatus = state.taskStatus
  let consecutiveFailures = 0

  taps.setPhase('task-review')

  while (true) {
    const feedback = await promptForTaskApproval(tasks)
    if (!feedback) break

    try {
      tasks = await refinePlanToTasks(planContent, tasksPath, feedback, cwd)
      if (tasks.length === 0) {
        consecutiveFailures++
        taps.setError('Architect returned empty task list. Please provide different feedback.')
        if (consecutiveFailures >= MAX_REFINEMENT_FAILURES) {
          throw new Error(
            `Refinement failed ${consecutiveFailures} times. Check your setup (API, prompts) and try again. Press Enter to accept current tasks on next run.`,
          )
        }
        taps.appendStream('Press Enter to accept current tasks, or describe different changes.\n')
        continue
      }
      consecutiveFailures = 0
      taskStatus = Object.fromEntries(
        tasks.map((t: { id: string }) => [t.id, 'pending'] as const),
      )
      taps.persistTasks({
        ...ctx,
        config,
        state: { ...state, tasks, taskStatus },
        taps,
      })
    } catch (e) {
      consecutiveFailures++
      taps.setError(`Refinement failed: ${(e as Error)?.toString()}`)
      if (consecutiveFailures >= MAX_REFINEMENT_FAILURES) {
        throw new Error(
          `Refinement failed ${consecutiveFailures} times. Check your setup (API, prompts) and try again. Press Enter to accept current tasks on next run.`,
        )
      }
      taps.appendStream('Press Enter to accept current tasks, or describe different changes.\n')
    }
  }

  return {
    ...ctx,
    state: { ...state, tasks, taskStatus },
  }
}
