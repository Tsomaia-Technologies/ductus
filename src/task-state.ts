import * as fs from 'fs'
import * as path from 'path'
import { z } from 'zod/v3'
import { TaskSchema, type Task } from './schema.js'

export const TaskStatusSchema = z.enum(['pending', 'completed', 'failed'])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export interface TasksWithStatus {
  tasks: Task[]
  status: Record<string, TaskStatus>
}

const TasksFileLegacySchema = z.array(TaskSchema)
const TasksFileSchema = z.union([
  TasksFileLegacySchema,
  z.object({
    tasks: z.array(TaskSchema),
    status: z.record(TaskStatusSchema).optional(),
  }),
])

/**
 * Loads tasks and status from .ductus/<feature>/tasks.json.
 * Validates with Zod; throws on invalid or corrupted file.
 * If file has legacy format (array only), returns all pending.
 */
export function loadTasksWithStatus(
  cwd: string,
  feature: string,
): TasksWithStatus | null {
  const filePath = path.join(cwd, '.ductus', feature, 'tasks.json')
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid tasks.json: malformed JSON in ${filePath}`)
  }

  const parseResult = TasksFileSchema.safeParse(parsed)
  if (!parseResult.success) {
    throw new Error(
      `Invalid tasks.json: ${parseResult.error.message}. Fix or remove ${filePath}`,
    )
  }

  const data = parseResult.data
  let tasks: Task[]
  let status: Record<string, TaskStatus>

  if (Array.isArray(data)) {
    tasks = data
    status = Object.fromEntries(tasks.map((t) => [t.id, 'pending'] as const))
  } else {
    tasks = data.tasks
    status =
      data.status ?? Object.fromEntries(tasks.map((t) => [t.id, 'pending'] as const))
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
