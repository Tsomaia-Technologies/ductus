import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
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
import { createStubTaps } from '../src/pipeline/taps'

function createTestContext(overrides?: Partial<PipelineContext>): PipelineContext {
  const config: PipelineConfig = {
    cwd: '/tmp',
    feature: 'test',
    planPath: '/tmp/plan.md',
    planContent: '',
    maxRetries: 2,
    retryFailed: false,
    checks: [
      { id: 'build', type: 'global', command: 'npm run build', run_when: 'per_task' },
      { id: 'test', type: 'global', command: 'npm test', run_when: 'per_task' },
    ],
    agentPath: 'agent',
    plainMode: false,
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
    lastCompletedRef: null,
    isResume: false,
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
      expect(setError).toHaveBeenCalledWith('oops', expect.any(Object))
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
      expect(setError).toHaveBeenCalledWith('stage failed', expect.any(Object))
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

describe('pipeline taps', () => {
  describe('createStubTaps', () => {
    it('persistTasks writes tasks.json', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ductus-taps-'))
      const ctx = createTestContext({
        config: {
          cwd: tmpDir,
          feature: 'my-feature',
          planPath: '/tmp/plan.md',
          planContent: '',
          maxRetries: 2,
          retryFailed: false,
          checks: [
            { id: 'build', type: 'global', command: 'npm run build', run_when: 'per_task' },
            { id: 'test', type: 'global', command: 'npm test', run_when: 'per_task' },
          ],
          agentPath: 'agent',
          plainMode: false,
        },
        state: {
          tasks: [{ id: 'task-1', summary: 'Test task with sufficient length', description: 'A task for testing persist', objective: 'Objective for the task', requirements: [], constraints: [] }],
          taskStatus: { 'task-1': 'completed' },
          sortedTaskIds: ['task-1'],
          currentTaskId: null,
          currentAttempt: 0,
          engineerReport: null,
          lastReviewResult: null,
          headRefBeforeTask: null,
          diff: null,
          commandResults: null,
          lastError: null,
          lastCompletedRef: null,
          isResume: false,
        },
        taps: createDefaultTaps(),
      })
      const taps = createStubTaps()
      taps.persistTasks(ctx)
      const filePath = path.join(tmpDir, '.ductus', 'my-feature', 'tasks.json')
      expect(fs.existsSync(filePath)).toBe(true)
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      expect(parsed.tasks).toHaveLength(1)
      expect(parsed.tasks[0].id).toBe('task-1')
      expect(parsed.status['task-1']).toBe('completed')
      fs.rmSync(tmpDir, { recursive: true })
    })

    it('setPhase logs to console', () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation()
      const taps = createStubTaps()
      taps.setPhase('engineer')
      expect(logSpy).toHaveBeenCalledWith('[ductus] Phase: engineer')
      logSpy.mockRestore()
    })

    it('setError logs to console.error', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation()
      const taps = createStubTaps()
      taps.setError('something failed')
      expect(errorSpy).toHaveBeenCalledWith('[ductus]', 'something failed')
      errorSpy.mockRestore()
    })
  })
})
