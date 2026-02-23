import type { PipelineContext, PipelineStage } from '../context.js'
import { topSortTasks } from '../../topsort.js'

/**
 * Computes topological order from task dependencies. Throws on cycle or invalid ref.
 */
export const topologicalSortStage: PipelineStage = async (ctx: PipelineContext) => {
  const sortedTaskIds = topSortTasks(ctx.state.tasks)
  return {
    ...ctx,
    state: { ...ctx.state, sortedTaskIds },
  }
}
