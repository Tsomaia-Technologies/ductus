import { PlannerHeadersSchema, Task, TaskListSchema, TaskSchemaJSON } from '../schema'
import { extractJsonArray } from '../utils'
import { loadPrompts } from '../load-prompts'
import { runAgentWithStream } from '../run-agent'

export async function convertPlanToTasks(plan: string): Promise<Task[]> {
  let i = 0

  const prompts = loadPrompts('architect', { plan, schema: TaskSchemaJSON })

  const maxTrials = Math.max(prompts.length, 5)

  while (i < maxTrials) {
    try {
      const { data, content } = prompts[i % prompts.length]
      const { model } = PlannerHeadersSchema.parse(data)
      const args = [
        '--mode', 'plan',
        '--model', model,
        '--output-format', 'stream-json',
        '--stream-partial-output',
        '--print', content,
      ]

      const raw = await runAgentWithStream({
        args,
        spinnerText: 'Running planner agent to break down plan into tasks...',
      })

      return TaskListSchema.parse(JSON.parse(extractJsonArray(raw)))
    } catch (e) {
      ++i
      console.log(`[convertPlanToTasks] trial ${i}/${maxTrials} failed:`, e?.toString())
    }
  }

  throw new Error('Unable to convert plans to tasks.')
}
