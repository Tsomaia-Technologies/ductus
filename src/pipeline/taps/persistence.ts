import type { PipelineContext } from '../context'
import { saveTasksWithStatus } from '../../task-state'

/**
 * Returns the persistTasks tap implementation.
 * Writes tasks and status to .ductus/<feature>/tasks.json.
 */
export function createPersistTap(): (ctx: PipelineContext) => void {
  return (ctx: PipelineContext) => {
    saveTasksWithStatus(ctx.config.cwd, ctx.config.feature, {
      tasks: ctx.state.tasks,
      status: ctx.state.taskStatus,
    })
  }
}
