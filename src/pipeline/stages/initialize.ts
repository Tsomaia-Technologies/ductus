import * as fs from 'fs'
import * as path from 'path'
import type { PipelineContext, PipelineStage } from '../context.js'
import { loadTasksWithStatus } from '../../task-state.js'
import { getHeadRef } from '../../git.js'
import { convertPlanToTasks } from '../../lambdas/convertPlanToTasks.js'

/**
 * Sets up directories, reads plan, loads or creates tasks.
 * Validates git repository. Populates tasks and taskStatus; sortedTaskIds filled by topsort stage.
 */
export const initializeStage: PipelineStage = async (ctx: PipelineContext) => {
  const { config, state, taps } = ctx
  const { cwd, feature, planPath } = config
  const featureDir = path.join(cwd, '.ductus', feature)
  fs.mkdirSync(featureDir, { recursive: true })

  try {
    await getHeadRef(cwd)
  } catch {
    throw new Error(
      'Not a git repository. ductus requires a git repo for the Engineer/Reviewer flow.',
    )
  }

  const planContent = fs.readFileSync(planPath, 'utf-8')
  const existing = loadTasksWithStatus(cwd, feature)
  const isResume =
    existing &&
    existing.tasks.length > 0 &&
    Object.values(existing.status).some((s) => s !== 'pending')

  let tasks = state.tasks
  let taskStatus = state.taskStatus
  let lastCompletedRef: string | null = null

  if (isResume && existing) {
    taps.setPhase('architect')
    taps.appendStream('Resuming previous run...\n')
    tasks = existing.tasks
    taskStatus = { ...existing.status }
    taps.setTasks?.(tasks)
    lastCompletedRef = await getHeadRef(cwd)
    return {
      ...ctx,
      config: { ...config, planContent },
      state: {
        ...state,
        tasks,
        taskStatus,
        sortedTaskIds: [],
        lastCompletedRef,
        isResume: true,
      },
    }
  }

  {
    taps.setPhase('architect')
    taps.appendStream('Spawning Architect Agent to break down the plan...\n')
    taps.setStreamActive(true)
    try {
      tasks = await convertPlanToTasks(planContent, {
        onChunk: (c) => taps.appendStream(c),
      })
    } finally {
      taps.setStreamActive(false)
    }
    taps.setTasks?.(tasks)
    taps.appendStream(`Architect identified ${tasks.length} tasks.\n`)
    if (tasks.length === 0) {
      return {
        ...ctx,
        config: { ...config, planContent },
        state: {
          ...state,
          tasks: [],
          taskStatus: {},
          sortedTaskIds: [],
          lastCompletedRef: null,
          isResume: false,
        },
      }
    }
    taskStatus = Object.fromEntries(
      tasks.map((t: { id: string }) => [t.id, 'pending'] as const),
    )
    taps.persistTasks({
      ...ctx,
      config: { ...config, planContent },
      state: { ...state, tasks, taskStatus, lastCompletedRef: null, isResume: false },
      taps,
    })
  }

  return {
    ...ctx,
    config: { ...config, planContent },
    state: {
      ...state,
      tasks,
      taskStatus,
      sortedTaskIds: [], // filled by topsort stage
      lastCompletedRef: null,
      isResume: false,
    },
  }
}
