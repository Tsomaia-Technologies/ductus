import { ArchitectHeadersSchema, Task, TaskListSchema, TaskListSchemaJSON } from '../schema.js'
import { extractJsonArray } from '../utils.js'
import { loadPrompts } from '../load-prompts.js'
import { runAgentWithStream } from '../run-agent.js'

export async function refinePlanToTasks(
  plan: string,
  tasksFilePath: string,
  userFeedback: string,
  cwd = process.cwd(),
  options?: { onChunk?: (chunk: string) => void; agentPath?: string },
): Promise<Task[]> {
  let i = 0
  const { onChunk, agentPath = 'agent' } = options ?? {}

  const prompts = loadPrompts(
    'architect-refine',
    { plan, schema: TaskListSchemaJSON, tasksFilePath, userFeedback },
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
        agentPath,
        spinnerText: 'Running refinement architect agent...',
        onChunk,
        stdin: 'ignore',
      })

      return TaskListSchema.parse(JSON.parse(extractJsonArray(raw)))
    } catch (e) {
      ++i
      console.log(`[refinePlanToTasks] trial ${i}/${maxTrials} failed:`, e?.toString())
    }
  }

  throw new Error('Unable to refine plan to tasks.')
}
