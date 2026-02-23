#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'
import { Command } from 'commander'
import { ejectPrompts } from '../load-prompts'
import { convertPlanToTasks } from '../lambdas/convertPlanToTasks'
import { refinePlanToTasks } from '../lambdas/refinePlanToTasks'
import { runImplementationEngineer } from '../lambdas/runImplementationEngineer'
import { runReviewer } from '../lambdas/runReviewer'
import { getHeadRef, getDiff } from '../git'
import type { Approval, Rejection } from '../schema'
import type { Task } from '../schema'
import { runRemediationEngineer } from '../lambdas/runRemediationEngineer'
import { promptForTaskApproval } from '../prompt-user'
import { commitWithRetryOnFailure } from '../commit'

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
  .action(async (feature: string, options: { plan: string; maxRetries?: string }) => {
    const cwd = process.cwd()
    const planPath = options.plan
    const maxRetries = Math.max(0, parseInt(options.maxRetries ?? '2', 10) || 2)
    const featureDir = path.join(cwd, '.ductus', feature)

    fs.mkdirSync(featureDir, { recursive: true })

    const planContent = fs.readFileSync(planPath, 'utf-8')

    console.log('Spawning Architect Agent to break down the plan...')

    let tasks: Task[] = await convertPlanToTasks(planContent)

    fs.writeFileSync(
      path.join(featureDir, 'tasks.json'),
      JSON.stringify(tasks, null, 2),
      'utf-8',
    )

    console.log(`Architect identified ${tasks.length} tasks.`)

    if (tasks.length === 0) {
      console.log('No tasks to execute.')
      return
    }

    const tasksPath = path.resolve(cwd, '.ductus', feature, 'tasks.json')

    while (true) {
      const feedback = await promptForTaskApproval(tasks)
      if (!feedback) break

      try {
        tasks = await refinePlanToTasks(planContent, tasksPath, feedback, cwd)
        if (tasks.length === 0) {
          console.error('Architect returned empty task list. Please provide different feedback.')
          continue
        }
        fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf-8')
      } catch (e) {
        console.error('Refinement failed:', e?.toString())
        console.log('Please try again with different feedback, or press Enter to accept current tasks.')
      }
    }

    try {
      await getHeadRef(cwd)
    } catch {
      throw new Error(
        'Not a git repository. ductus requires a git repo for the Engineer/Reviewer flow.',
      )
    }

    for (const [index, task] of tasks.entries()) {
      let attempt = 0
      const maxAttempts = maxRetries + 1
      let result: Approval | Rejection | null = null
      let engineerReport: Awaited<ReturnType<typeof runImplementationEngineer>> | null = null

      while (attempt < maxAttempts) {
        console.log(
          `\nEngineer starting Task ${index + 1}/${tasks.length}: ${task.id} - ${task.summary}`,
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
        result = await runReviewer(task, diff, cwd)

        if (result.decision === 'approved') {
          const message = engineerReport?.commitMessage?.trim() || task.summary
          await commitWithRetryOnFailure(message, cwd)
          console.log(`Task ${index + 1} approved and committed.`)
          break
        }

        console.log(
          `Reviewer rejected (attempt ${attempt + 1}/${maxAttempts}): ${result.rejection_reason}`,
        )
        attempt++

        if (attempt >= maxAttempts) {
          throw new Error(
            `Task ${task.id} rejected after ${maxAttempts} attempts`,
          )
        }
      }
    }

    console.log('\nOrchestration complete. All tasks executed.')
  })

program.parse()
