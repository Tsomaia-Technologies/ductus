import type { PipelineContext, PipelineStage } from '../context'

/**
 * Sets phase to complete and signals end of pipeline.
 */
export const finalizeStage: PipelineStage = async (ctx: PipelineContext) => {
  ctx.taps.setPhase('complete')
  if (ctx.state.tasks.length === 0) {
    ctx.taps.appendStream('No tasks to execute.\n')
  } else {
    ctx.taps.appendStream('\nOrchestration complete. All tasks executed.\n')
  }
  return ctx
}
