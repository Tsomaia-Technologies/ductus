import type { PipelineContext, PipelineStage } from '../context'
import { topSortTasks } from '../../topsort'

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
