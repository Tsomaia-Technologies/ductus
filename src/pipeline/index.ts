import type { PipelineContext, PipelineState } from './context'

/**
 * A stage receives context and returns updated context.
 * Stages receive a shallow copy; prefer returning new state over mutating in place.
 * Side effects go through taps.
 */
export type PipelineStage = (
  ctx: PipelineContext,
) => Promise<PipelineContext>

export interface PipeOptions {
  /**
   * Called when a stage throws, after lastError is set and setError tap invoked.
   * Use for cleanup (e.g. persist partial state) before the error rethrows.
   */
  onFail?: (ctx: PipelineContext) => void | Promise<void>
}

/**
 * Returns a shallow copy of the context. Config and state are shallow-copied;
 * taps are shared (stateless handlers). Encourages stages to avoid mutating
 * the previous context.
 */
export function shallowCopyContext(ctx: PipelineContext): PipelineContext {
  return {
    config: { ...ctx.config },
    state: shallowCopyState(ctx.state),
    taps: ctx.taps,
  }
}

function shallowCopyState(state: PipelineState): PipelineState {
  return {
    ...state,
    // Arrays and objects stay as refs; primitives and top-level fields are copied.
    // For full isolation, stages should replace tasks/taskStatus rather than mutating.
  }
}

/**
 * Records the error in context and notifies taps. Call this when a stage fails
 * before rethrowing, so the UI can react and lastError is populated.
 */
export function failContext(
  ctx: PipelineContext,
  error: unknown,
): PipelineContext {
  const message = error instanceof Error ? error.message : String(error)
  const failedState: PipelineState = {
    ...ctx.state,
    lastError: message,
  }
  const failedCtx: PipelineContext = {
    ...ctx,
    state: failedState,
  }
  failedCtx.taps.setError(message)
  return failedCtx
}

function isPipeOptions(x: unknown): x is PipeOptions {
  return (
    x !== null &&
    typeof x === 'object' &&
    'onFail' in (x as object)
  )
}

/**
 * Chains async stages into a single pipeline.
 * - Each stage receives a shallow copy of the context to discourage mutation of prior state.
 * - If a stage throws, lastError is set, setError tap invoked, onFail (if any) runs, then the error rethrows.
 *
 * Options: pass { onFail: (ctx) => {...} } as the last argument to run cleanup on failure.
 */
export function pipe(
  ...args: PipelineStage[] | [...PipelineStage[], PipeOptions]
): PipelineStage {
  const options: PipeOptions | undefined =
    args.length > 0 && isPipeOptions(args[args.length - 1])
      ? (args.pop() as PipeOptions)
      : undefined
  const stages = args as PipelineStage[]

  return async (ctx: PipelineContext): Promise<PipelineContext> => {
    return runPipelineWithOptions(ctx, stages, options)
  }
}

async function runPipelineWithOptions(
  initialCtx: PipelineContext,
  stages: PipelineStage[],
  options?: PipeOptions,
): Promise<PipelineContext> {
  let result = initialCtx
  for (const stage of stages) {
    const inputCopy = shallowCopyContext(result)
    try {
      result = await stage(inputCopy)
    } catch (error) {
      const failedCtx = failContext(inputCopy, error)
      if (options?.onFail) {
        await options.onFail(failedCtx)
      }
      throw error
    }
  }
  return result
}
