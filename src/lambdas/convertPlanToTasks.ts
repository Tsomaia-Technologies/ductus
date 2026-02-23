import { ArchitectHeadersSchema, Task, TaskListSchema, TaskSchemaJSON } from '../schema'
import { extractJsonArray } from '../utils'
import { loadPrompts } from '../load-prompts'
import { runAgentWithStream } from '../run-agent'

export async function convertPlanToTasks(
  plan: string,
  options?: { cwd?: string; onChunk?: (chunk: string) => void },
): Promise<Task[]> {
  let i = 0
  const { onChunk } = options ?? {}

  const prompts = loadPrompts('architect', { plan, schema: TaskSchemaJSON })

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
        spinnerText: 'Running architect agent to break down plan into tasks...',
        onChunk,
      })

      return TaskListSchema.parse(JSON.parse(extractJsonArray(raw)))
    } catch (e) {
      ++i
      console.log(`[convertPlanToTasks] trial ${i}/${maxTrials} failed:`, e?.toString())
    }
  }

  throw new Error('Unable to convert plans to tasks.')
}
