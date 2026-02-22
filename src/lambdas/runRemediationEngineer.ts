import type { Task } from '../schema'
import type { Rejection } from '../schema'
import { loadPrompts } from '../load-prompts'
import { runAgentWithExecution } from '../run-agent'

export async function runRemediationEngineer(
  task: Task,
  rejection: Rejection,
  cwd = process.cwd(),
): Promise<void> {
  const prompts = loadPrompts(
    'remediation-engineer',
    {
      task,
      rejection,
    },
    cwd,
  )

  const { data, content } = prompts[0]
  const model = (data as { model?: string })?.model ?? 'auto'

  await runAgentWithExecution({
    args: ['--force', '--model', model, '--print', content],
  })
}
