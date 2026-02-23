import { ArchitectHeadersSchema, Task, TaskListSchema, TaskSchemaJSON } from '../schema'
import { extractJsonArray } from '../utils'
import { loadPrompts } from '../load-prompts'
import { runAgentWithStream } from '../run-agent'

export async function refinePlanToTasks(
  plan: string,
  tasksFilePath: string,
  userFeedback: string,
  cwd = process.cwd(),
): Promise<Task[]> {
  let i = 0

  const prompts = loadPrompts(
    'architect-refine',
    { plan, schema: TaskSchemaJSON, tasksFilePath, userFeedback },
    cwd,
  )

  const maxTrials = Math.max(prompts.length, 5)

  while (i < maxTrials) {
    try {
      const { data, content } = prompts[i % prompts.length]
      const { model } = ArchitectHeadersSchema.parse(data)
      const args = [
        '--mode', 'plan',
        '--model', model,
        '--output-format', 'stream-json',
        '--stream-partial-output',
        '--print', content,
      ]

      const raw = await runAgentWithStream({
        args,
        spinnerText: 'Running refinement architect agent...',
      })

      return TaskListSchema.parse(JSON.parse(extractJsonArray(raw)))
    } catch (e) {
      ++i
      console.log(`[refinePlanToTasks] trial ${i}/${maxTrials} failed:`, e?.toString())
    }
  }

  throw new Error('Unable to refine plan to tasks.')
}
