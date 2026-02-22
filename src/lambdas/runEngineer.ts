import type { Task } from '../schema'
import type { Rejection } from '../schema'
import { loadPrompts } from '../load-prompts'
import { runAgentWithExecution } from '../run-agent'

export async function runEngineer(
  task: Task,
  reviewerFeedback?: Rejection,
  cwd = process.cwd(),
): Promise<void> {
  const prompts = loadPrompts(
    'engineer',
    {
      task,
      reviewerFeedback,
    },
    cwd,
  )

  const { data, content } = prompts[0]
  const model = (data as { model?: string })?.model ?? 'auto'

  await runAgentWithExecution({
    args: ['--force', '--model', model, '--print', content],
  })
}
