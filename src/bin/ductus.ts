#!/usr/bin/env node
import * as path from 'path'
import { Command } from 'commander'
import { ejectPrompts } from '../load-prompts'
import { pipe } from '../pipeline'
import {
  initializeStage,
  architectStage,
  topologicalSortStage,
  executeTasksStage,
  finalizeStage,
} from '../pipeline/stages'
import { createStubTaps } from '../pipeline/taps'
import type { PipelineConfig, PipelineState } from '../pipeline/context'

const program = new Command()

program
  .name('ductus')
  .description(
    'Agent-to-agent coordination orchestrator for autonomous task execution',
  )

program
  .command('eject')
  .description('Eject prompts from package to .ductus/prompts')
  .option('--overwrite', 'Overwrite existing prompts (default: only add missing)')
  .action((opts: { overwrite?: boolean }) => {
    ejectPrompts(process.cwd(), { overwrite: opts.overwrite })
  })

program
  .command('run')
  .description('Run plan to tasks, then Engineer and Reviewer per task')
  .argument('<feature>', 'feature name')
  .requiredOption('-p, --plan <path>', 'path to the plan file')
  .option(
    '--max-retries <n>',
    'max Engineer retries per task when Reviewer rejects',
    '2',
  )
  .option('--retry-failed', 'Retry tasks marked failed from a previous run')
  .option('--no-ui', 'Disable Ink UI; use plain console (for CI or pipes)')
  .option('--plain', 'Alias for --no-ui')
  .action(async (feature: string, options: { plan: string; maxRetries?: string; retryFailed?: boolean; noUi?: boolean; plain?: boolean }) => {
    const cwd = process.cwd()
    const planPath = path.resolve(options.plan)
    const maxRetries = Math.max(0, parseInt(options.maxRetries ?? '2', 10) || 2)
    const retryFailed = options.retryFailed ?? false

    const config: PipelineConfig = {
      cwd,
      feature,
      planPath,
      planContent: '', // Initialize stage reads from planPath
      maxRetries,
      retryFailed,
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

    const opts = options as { noUi?: boolean; plain?: boolean }
    const disableUI =
      process.argv.includes('--no-ui') ||
      process.argv.includes('--plain') ||
      opts.noUi === true ||
      opts.plain === true
    const useUI = !disableUI
    const tapsRef = { current: null as any }

    if (useUI) {
      const { createInkTaps } = await import('../pipeline/taps/ink-taps')
      const { runWithInk } = await import('../ui')
      const taps = createInkTaps(tapsRef)
      const runPipeline = pipe(
        initializeStage,
        architectStage,
        topologicalSortStage,
        executeTasksStage,
        finalizeStage,
        {
          onFail: (ctx) => {
            if (ctx.state.tasks.length > 0 && Object.keys(ctx.state.taskStatus).length > 0) {
              taps.persistTasks(ctx)
            }
          },
        },
      )
      await runWithInk({
        feature,
        maxRetries,
        tapsRef,
        runPipeline: async () => {
          await runPipeline({ config, state, taps })
        },
      })
    } else {
      const taps = createStubTaps()
      const runPipeline = pipe(
        initializeStage,
        architectStage,
        topologicalSortStage,
        executeTasksStage,
        finalizeStage,
        {
          onFail: (ctx) => {
            if (ctx.state.tasks.length > 0 && Object.keys(ctx.state.taskStatus).length > 0) {
              taps.persistTasks(ctx)
            }
          },
        },
      )
      await runPipeline({ config, state, taps })
    }
  })

program.parse()
