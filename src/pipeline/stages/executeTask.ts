import type { PipelineContext } from '../context.js'
import type { Task } from '../../schema.js'
import { runImplementationEngineer } from '../../lambdas/runImplementationEngineer.js'
import { runReviewer } from '../../lambdas/runReviewer.js'
import { runRemediationEngineer } from '../../lambdas/runRemediationEngineer.js'
import { runVerificationCommands } from '../../verify.js'
import { commitWithRetryOnFailure } from '../../commit.js'
import { getHeadRef, getDiff, revertToRef } from '../../git.js'

/**
 * Runs implement -> verify -> review -> (commit | remediate) for a single task.
 * Encapsulates the retry loop. Returns updated context with taskStatus and lastCompletedRef updated.
 */
export async function executeTaskSubPipe(
  ctx: PipelineContext,
  task: Task,
  taskIndex: number,
  totalTasks: number,
): Promise<PipelineContext> {
  const { config, state, taps } = ctx
  const { cwd, maxRetries } = config
  const taskId = task.id

  taps.setPhase('engineer')
  taps.setCurrentTask?.(taskIndex, taskId)
  taps.appendStream(
    `\nEngineer starting Task ${taskIndex + 1}/${totalTasks}: ${task.id} - ${task.summary}\n`,
  )

  let lastCompletedRef = state.lastCompletedRef
  const maxAttempts = maxRetries + 1
  let attempt = 0
  let engineerReport: Awaited<ReturnType<typeof runImplementationEngineer>> | null = null
  let result: Awaited<ReturnType<typeof runReviewer>> | null = null
  let taskStatus = { ...state.taskStatus }

  while (attempt < maxAttempts) {
    if (attempt > 0) {
      taps.appendStream(`Retry attempt ${attempt}/${maxRetries}\n`)
    }

    const beforeRef = await getHeadRef(cwd)

    const onChunk = (c: string) => taps.appendStream(c)
    taps.setStreamActive(true)
    try {
      if (result?.decision === 'rejected') {
        taps.setPhase('remediation')
        const diffOfRejected = await getDiff(beforeRef, cwd)
        await runRemediationEngineer(task, result, diffOfRejected, cwd, { onChunk })
      } else {
        taps.setPhase('engineer')
        engineerReport = await runImplementationEngineer(task, cwd, { onChunk })
      }

      const diff = await getDiff(beforeRef, cwd)
      const commandResults = await runVerificationCommands(
        engineerReport?.checks ?? [],
        cwd,
      )

      taps.setPhase('reviewer')
      result = await runReviewer(task, diff, cwd, { commandResults, onChunk })
    } finally {
      taps.setStreamActive(false)
    }

    if (result.decision === 'approved') {
      const message = engineerReport?.commitMessage?.trim() || task.summary
      taps.setPhase('commit-prompt')
      try {
        await commitWithRetryOnFailure(message, cwd, {
          forceAddIgnored: config.forceAddIgnored,
        })
        taskStatus[taskId] = 'completed'
        lastCompletedRef = await getHeadRef(cwd)
        taps.appendStream(
          `Task ${taskIndex + 1}/${totalTasks} approved and committed.\n`,
        )
        taps.persistTasks({
          ...ctx,
          state: { ...state, taskStatus, lastCompletedRef },
        })
        return {
          ...ctx,
          state: { ...state, taskStatus, lastCompletedRef },
        }
      } catch (commitErr) {
        const errMsg = (commitErr as Error)?.message ?? String(commitErr)
        taps.setError(
          `Commit skipped: ${errMsg}. Run with --force-add or commit manually.`,
        )
        taps.appendStream(
          `Task ${taskIndex + 1}/${totalTasks} approved but commit failed. Changes remain in working tree. Continuing.\n`,
        )
        taskStatus[taskId] = 'completed'
        taps.persistTasks({
          ...ctx,
          state: { ...state, taskStatus, lastCompletedRef },
        })
        return {
          ...ctx,
          state: { ...state, taskStatus, lastCompletedRef },
        }
      }
    }

    taps.appendStream(
      `Reviewer rejected (attempt ${attempt + 1}/${maxAttempts}): ${result.rejection_reason}\n`,
    )
    attempt++

    if (attempt >= maxAttempts) {
      taskStatus[taskId] = 'failed'
      taps.persistTasks({
        ...ctx,
        state: { ...state, taskStatus },
      })
      throw new Error(`Task ${task.id} rejected after ${maxAttempts} attempts`)
    }
  }

  // Unreachable but satisfies type checker
  return { ...ctx, state: { ...state, taskStatus } }
}

/**
 * Reverts git to lastCompletedRef before retrying a failed task.
 */
export async function revertBeforeRetry(
  ctx: PipelineContext,
): Promise<void> {
  const { lastCompletedRef } = ctx.state
  if (!lastCompletedRef) return
  await revertToRef(lastCompletedRef, ctx.config.cwd)
}
