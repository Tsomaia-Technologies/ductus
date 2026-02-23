import type { PipelineContext } from './context'

/**
 * A stage receives context and returns updated context.
 * Stages are pure with respect to pipeline flow; side effects go through taps.
 */
export type PipelineStage = (
  ctx: PipelineContext,
) => Promise<PipelineContext>

/**
 * Chains async stages into a single pipeline.
 * Each stage receives the context from the previous stage.
 */
export function pipe(...stages: PipelineStage[]): PipelineStage {
  return async (ctx: PipelineContext): Promise<PipelineContext> => {
    let result = ctx
    for (const stage of stages) {
      result = await stage(result)
    }
    return result
  }
}
