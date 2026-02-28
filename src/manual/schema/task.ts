import { z } from 'zod/v3'
import { toJsonSchema } from '../utils/schema-utils.js'

export const TaskSchema = z.object({
  taskId: z.string().describe('Kebab-case slug, e.g. db-setup, auth-api'),
  summary: z.string().min(20).describe('One-line summary for headline and human review'),
  description: z.string().min(20).describe('Full details for the Engineer. In case of bugs - steps to reproduce, current state, expected state. In case of tasks any detail that adds helpful context.'),
  objective: z.string().min(20).describe('The primary goal of this task.'),
  requirements: z.array(z.string()).describe('Specific functional requirements to be met.'),
  constraints: z.array(z.string()).describe('Non-functional requirements or architectural boundaries.'),
  dependsOn: z.array(z.string()).optional().describe('Task ids that must complete before this task runs. E.g. ["db-setup"] if this task needs the database.'),
})

export type Task = z.infer<typeof TaskSchema>

export const TaskSchemaJSON = toJsonSchema(TaskSchema)
