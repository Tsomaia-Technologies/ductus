import {
  pipe,
  shallowCopyContext,
  failContext,
} from '../src/pipeline'
import {
  createDefaultTaps,
  type PipelineContext,
  type PipelineConfig,
  type PipelineState,
} from '../src/pipeline/context'

function createTestContext(overrides?: Partial<PipelineContext>): PipelineContext {
  const config: PipelineConfig = {
    cwd: '/tmp',
    feature: 'test',
    planPath: '/tmp/plan.md',
    planContent: '',
    maxRetries: 2,
    retryFailed: false,
  }
  const state: PipelineState = {
    tasks: [],
    taskStatus: {},
    sortedTaskIds: [],
    currentTaskId: null,
    currentAttempt: 0,
    engineerReport: null,
    lastReviewResult: null,
    headRefBeforeTask: null,
    diff: null,
    commandResults: null,
    lastError: null,
  }
  return {
    config,
    state,
    taps: createDefaultTaps(),
    ...overrides,
  }
}

describe('pipeline', () => {
  describe('shallowCopyContext', () => {
    it('returns a copy; mutating copy does not affect original', async () => {
      const ctx = createTestContext()
      const copy = shallowCopyContext(ctx)
      copy.state.currentAttempt = 99
      copy.config.maxRetries = 7
      expect(ctx.state.currentAttempt).toBe(0)
      expect(ctx.config.maxRetries).toBe(2)
    })

    it('shares taps reference', () => {
      const ctx = createTestContext()
      const copy = shallowCopyContext(ctx)
      expect(copy.taps).toBe(ctx.taps)
    })
  })

  describe('failContext', () => {
    it('sets lastError in state and calls setError tap', () => {
      const setError = jest.fn()
      const ctx = createTestContext({
        taps: { ...createDefaultTaps(), setError },
      })
      const failed = failContext(ctx, new Error('oops'))
      expect(failed.state.lastError).toBe('oops')
      expect(setError).toHaveBeenCalledWith('oops')
    })

    it('handles non-Error values', () => {
      const ctx = createTestContext()
      const failed = failContext(ctx, 'string error')
      expect(failed.state.lastError).toBe('string error')
    })
  })

  describe('pipe', () => {
    it('composes stages and passes context through', async () => {
      const pipeline = pipe(
        async (ctx) => ({
          ...ctx,
          state: { ...ctx.state, currentAttempt: 1 },
        }),
        async (ctx) => ({
          ...ctx,
          state: { ...ctx.state, currentAttempt: ctx.state.currentAttempt + 1 },
        }),
      )
      const ctx = createTestContext()
      const result = await pipeline(ctx)
      expect(result.state.currentAttempt).toBe(2)
    })

    it('passes shallow copy to each stage', async () => {
      const received: PipelineContext[] = []
      const pipeline = pipe(
        async (ctx) => {
          received.push(ctx)
          return { ...ctx, state: { ...ctx.state, currentAttempt: 1 } }
        },
        async (ctx) => {
          received.push(ctx)
          return ctx
        },
      )
      const initial = createTestContext()
      await pipeline(initial)
      expect(received.length).toBe(2)
      expect(received[0]).not.toBe(initial)
      expect(received[1]).not.toBe(received[0])
    })

    it('on stage throw: sets lastError, calls setError, invokes onFail, then rethrows', async () => {
      const setError = jest.fn()
      const onFail = jest.fn().mockResolvedValue(undefined)
      const pipeline = pipe(
        async (ctx) => ctx,
        async () => {
          throw new Error('stage failed')
        },
        { onFail },
      )
      const ctx = createTestContext({
        taps: { ...createDefaultTaps(), setError },
      })
      await expect(pipeline(ctx)).rejects.toThrow('stage failed')
      expect(setError).toHaveBeenCalledWith('stage failed')
      expect(onFail).toHaveBeenCalledTimes(1)
      const failedCtx = onFail.mock.calls[0][0]
      expect(failedCtx.state.lastError).toBe('stage failed')
    })
  })

  describe('createDefaultTaps', () => {
    it('all taps are no-ops and do not throw', () => {
      const taps = createDefaultTaps()
      const ctx = createTestContext()
      expect(() => taps.setPhase('engineer')).not.toThrow()
      expect(() => taps.appendStream('x')).not.toThrow()
      expect(() => taps.setStreamActive(true)).not.toThrow()
      expect(() => taps.setError('err')).not.toThrow()
      expect(() => taps.persistTasks(ctx)).not.toThrow()
    })
  })
})
