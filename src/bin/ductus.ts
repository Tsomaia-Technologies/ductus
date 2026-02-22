#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'
import { Command } from 'commander'
import { convertPlanToTasks } from '../lambdas/convertPlanToTasks'
import { runEngineer } from '../lambdas/runEngineer'
import { runReviewer } from '../lambdas/runReviewer'
import { getHeadRef, getDiff } from '../git'
import type { Approval, Rejection } from '../schema'

const program = new Command()

program
  .name('ductus')
  .description(
    'Agent-to-agent coordination orchestrator for autonomous task execution',
  )
  .argument('<feature>', 'feature name')
  .requiredOption('-p, --plan <path>', 'path to the plan file')
  .option(
    '--max-retries <n>',
    'max Engineer retries per task when Reviewer rejects',
    '2',
  )
  .action(async (feature: string, options: { plan: string; maxRetries: string }) => {
    const planPath = options.plan
    const maxRetries = Math.max(0, parseInt(options.maxRetries, 10) || 2)
    const cwd = process.cwd()
    const featureDir = path.join(cwd, '.ductus', feature)

    fs.mkdirSync(featureDir, { recursive: true })

    const planContent = fs.readFileSync(planPath, 'utf-8')

    console.log('Spawning Architect Agent to break down the plan...')

    const tasks = await convertPlanToTasks(planContent)

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

      while (attempt < maxAttempts) {
        console.log(
          `\nEngineer starting Task ${index + 1}/${tasks.length}: ${task.id} - ${task.summary}`,
        )
        if (attempt > 0) {
          console.log(`Retry attempt ${attempt}/${maxRetries}`)
        }

        const beforeRef = await getHeadRef(cwd)

        await runEngineer(
          task,
          result?.decision === 'rejected' ? result : undefined,
          cwd,
        )

        const diff = await getDiff(beforeRef, cwd)
        result = await runReviewer(task, diff, cwd)

        if (result.decision === 'approved') {
          console.log(`Task ${index + 1} approved.`)
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
