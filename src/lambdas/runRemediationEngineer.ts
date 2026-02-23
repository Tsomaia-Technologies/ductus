import type { Task } from '../schema.js'
import type { Rejection } from '../schema.js'
import { loadPrompts } from '../load-prompts.js'
import { runAgentWithExecution } from '../run-agent.js'

export async function runRemediationEngineer(
  task: Task,
  rejection: Rejection,
  diff: string,
  cwd = process.cwd(),
  options?: { onChunk?: (chunk: string) => void },
): Promise<void> {
  const prompts = loadPrompts(
    'remediation-engineer',
    {
      task,
      rejection,
      diff,
    },
    cwd,
  )

  const { data, content } = prompts[0]
  const model = (data as { model?: string })?.model ?? 'auto'

  await runAgentWithExecution({
    args: ['--force', '--model', model, '--print', content],
    onChunk: options?.onChunk,
  })
}
