import type { Task } from '../../schema.js'
import type { PipelineContext, PipelineStage } from '../context.js'
import { executeTaskSubPipe, revertBeforeRetry } from './executeTask.js'

/**
 * Iterates over sorted task ids, skips completed, runs executeTaskSubPipe per task.
 * For failed tasks with retryFailed, reverts git before retrying.
 */
export const executeTasksStage: PipelineStage = async (ctx: PipelineContext) => {
  const { config, state } = ctx
  const { sortedTaskIds, tasks } = state
  const taskById = new Map<string, Task>(tasks.map((t: Task) => [t.id, t]))
  let currentState = state

  for (const [index, taskId] of sortedTaskIds.entries()) {
    const task = taskById.get(taskId)
    if (!task) continue
    if (currentState.taskStatus[taskId] === 'completed') continue
    if (currentState.taskStatus[taskId] === 'failed' && !config.retryFailed) continue

    if (currentState.taskStatus[taskId] === 'failed' && config.retryFailed) {
      const ctxBeforeRevert = { ...ctx, state: currentState }
      await revertBeforeRetry(ctxBeforeRevert)
    }

    const ctxWithCurrentState = { ...ctx, state: currentState }
    currentState = (
      await executeTaskSubPipe(ctxWithCurrentState, task, index, sortedTaskIds.length)
    ).state
  }

  return { ...ctx, state: currentState }
}
