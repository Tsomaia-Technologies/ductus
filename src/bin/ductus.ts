#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'
import { Command } from 'commander'
import { ejectPrompts } from '../load-prompts'
import { convertPlanToTasks } from '../lambdas/convertPlanToTasks'
import { refinePlanToTasks } from '../lambdas/refinePlanToTasks'
import { runImplementationEngineer } from '../lambdas/runImplementationEngineer'
import { runReviewer } from '../lambdas/runReviewer'
import { getHeadRef, getDiff, revertToRef } from '../git'
import type { Approval, Rejection } from '../schema'
import type { Task } from '../schema'
import { runRemediationEngineer } from '../lambdas/runRemediationEngineer'
import { runVerificationCommands } from '../verify'
import { promptForTaskApproval } from '../prompt-user'
import { commitWithRetryOnFailure } from '../commit'
import { topSortTasks } from '../topsort'
import { loadTasksWithStatus, saveTasksWithStatus } from '../task-state'

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
  .action(async (feature: string, options: { plan: string; maxRetries?: string; retryFailed?: boolean }) => {
    const cwd = process.cwd()
    const planPath = options.plan
    const maxRetries = Math.max(0, parseInt(options.maxRetries ?? '2', 10) || 2)
    const retryFailed = options.retryFailed ?? false
    const featureDir = path.join(cwd, '.ductus', feature)

    fs.mkdirSync(featureDir, { recursive: true })

    let tasks: Task[]
    let taskStatus: Record<string, 'pending' | 'completed' | 'failed'>

    const existing = loadTasksWithStatus(cwd, feature)
    const isResume = existing && existing.tasks.length > 0 && Object.values(existing.status).some((s) => s !== 'pending')

    if (isResume && existing) {
      console.log('Resuming previous run...')
      tasks = existing.tasks
      taskStatus = { ...existing.status }
    } else {
      const planContent = fs.readFileSync(planPath, 'utf-8')
      console.log('Spawning Architect Agent to break down the plan...')
      tasks = await convertPlanToTasks(planContent)
      console.log(`Architect identified ${tasks.length} tasks.`)
      if (tasks.length === 0) {
        console.log('No tasks to execute.')
        return
      }
      taskStatus = Object.fromEntries(tasks.map((t) => [t.id, 'pending'] as const))
      saveTasksWithStatus(cwd, feature, { tasks, status: taskStatus })
    }

    const planContent = fs.readFileSync(planPath, 'utf-8')
    const tasksPath = path.resolve(cwd, '.ductus', feature, 'tasks.json')
    const MAX_REFINEMENT_FAILURES = 3
    let consecutiveFailures = 0

    if (!isResume) {
    while (true) {
      const feedback = await promptForTaskApproval(tasks)
      if (!feedback) break

      try {
        tasks = await refinePlanToTasks(planContent, tasksPath, feedback, cwd)
        if (tasks.length === 0) {
          consecutiveFailures++
          console.error('Architect returned empty task list. Please provide different feedback.')
          if (consecutiveFailures >= MAX_REFINEMENT_FAILURES) {
            throw new Error(
              `Refinement failed ${consecutiveFailures} times. Check your setup (API, prompts) and try again. Press Enter to accept current tasks on next run.`,
            )
          }
          continue
        }
        consecutiveFailures = 0
        taskStatus = Object.fromEntries(tasks.map((t) => [t.id, 'pending'] as const))
        saveTasksWithStatus(cwd, feature, { tasks, status: taskStatus })
      } catch (e) {
        consecutiveFailures++
        console.error('Refinement failed:', e?.toString())
        if (consecutiveFailures >= MAX_REFINEMENT_FAILURES) {
          throw new Error(
            `Refinement failed ${consecutiveFailures} times. Check your setup (API, prompts) and try again. Press Enter to accept current tasks on next run.`,
          )
        }
        console.log('Press Enter to accept current tasks, or describe different changes.')
      }
    }
    }

    try {
      await getHeadRef(cwd)
    } catch {
      throw new Error(
        'Not a git repository. ductus requires a git repo for the Engineer/Reviewer flow.',
      )
    }

    const sortedTaskIds = topSortTasks(tasks)
    const taskById = new Map(tasks.map((t) => [t.id, t]))
    let lastCompletedRef = await getHeadRef(cwd)

    for (const [index, taskId] of sortedTaskIds.entries()) {
      const task = taskById.get(taskId)
      if (!task) continue
      if (taskStatus[taskId] === 'completed') continue
      if (taskStatus[taskId] === 'failed' && !retryFailed) continue

      if (taskStatus[taskId] === 'failed' && retryFailed) {
        await revertToRef(lastCompletedRef, cwd)
      }

      let attempt = 0
      const maxAttempts = maxRetries + 1
      let result: Approval | Rejection | null = null
      let engineerReport: Awaited<ReturnType<typeof runImplementationEngineer>> | null = null

      while (attempt < maxAttempts) {
        console.log(
          `\nEngineer starting Task ${index + 1}/${sortedTaskIds.length}: ${task.id} - ${task.summary}`,
        )
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt}/${maxRetries}`)
        }

        const beforeRef = await getHeadRef(cwd)

        if (result?.decision === 'rejected') {
          const diffOfRejected = await getDiff(beforeRef, cwd)
          await runRemediationEngineer(
            task,
            result,
            diffOfRejected,
            cwd,
          )
        } else {
          engineerReport = await runImplementationEngineer(task, cwd)
        }

        const diff = await getDiff(beforeRef, cwd)
        const commandResults = await runVerificationCommands(
          engineerReport?.checks ?? [],
          cwd,
        )
        result = await runReviewer(task, diff, cwd, { commandResults })

        if (result.decision === 'approved') {
          const message = engineerReport?.commitMessage?.trim() || task.summary
          await commitWithRetryOnFailure(message, cwd)
          taskStatus[taskId] = 'completed'
          saveTasksWithStatus(cwd, feature, { tasks, status: taskStatus })
          lastCompletedRef = await getHeadRef(cwd)
          console.log(`Task ${index + 1}/${sortedTaskIds.length} approved and committed.`)
          break
        }

        console.log(
          `Reviewer rejected (attempt ${attempt + 1}/${maxAttempts}): ${result.rejection_reason}`,
        )
        attempt++

        if (attempt >= maxAttempts) {
          taskStatus[taskId] = 'failed'
          saveTasksWithStatus(cwd, feature, { tasks, status: taskStatus })
          throw new Error(
            `Task ${task.id} rejected after ${maxAttempts} attempts`,
          )
        }
      }
    }

    console.log('\nOrchestration complete. All tasks executed.')
  })

program.parse()
