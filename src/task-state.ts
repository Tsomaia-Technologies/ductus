import * as fs from 'fs'
import * as path from 'path'
import type { Task } from './schema.js'

export type TaskStatus = 'pending' | 'completed' | 'failed'

export interface TasksWithStatus {
  tasks: Task[]
  status: Record<string, TaskStatus>
}

/**
 * Loads tasks and status from .ductus/<feature>/tasks.json.
 * If file has legacy format (array only), returns all pending.
 */
export function loadTasksWithStatus(
  cwd: string,
  feature: string,
): TasksWithStatus | null {
  const filePath = path.join(cwd, '.ductus', feature, 'tasks.json')
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as { tasks?: Task[]; status?: Record<string, TaskStatus> } | Task[]

  let tasks: Task[]
  let status: Record<string, TaskStatus>

  if (Array.isArray(parsed)) {
    tasks = parsed
    status = Object.fromEntries(tasks.map((t) => [t.id, 'pending'] as const))
  } else if (parsed.tasks) {
    tasks = parsed.tasks
    status = parsed.status ?? Object.fromEntries(tasks.map((t) => [t.id, 'pending'] as const))
  } else {
    return null
  }

  for (const t of tasks) {
    if (!(t.id in status)) status[t.id] = 'pending'
  }

  return { tasks, status }
}

/**
 * Persists tasks and status to .ductus/<feature>/tasks.json.
 */
export function saveTasksWithStatus(
  cwd: string,
  feature: string,
  data: TasksWithStatus,
): void {
  const dir = path.join(cwd, '.ductus', feature)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'tasks.json'),
    JSON.stringify({ tasks: data.tasks, status: data.status }, null, 2),
    'utf-8',
  )
}
