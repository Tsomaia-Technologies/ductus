import { ReviewResultSchema } from '../schema'
import type { Approval, Rejection } from '../schema'
import type { Task } from '../schema'
import { ApprovalSchemaJSON, RejectionJSON } from '../schema'
import { extractJsonObject } from '../utils'
import { loadPrompts } from '../load-prompts'
import { runAgentWithStream } from '../run-agent'

export async function runReviewer(
  task: Task,
  diff: string,
  cwd = process.cwd(),
  options?: {
    commandResults?: Array<{ checkId: string; command: string; status: string; stdout: string; stderr: string }>
    onChunk?: (chunk: string) => void
  },
): Promise<Approval | Rejection> {
  let i = 0
  const commandResults = options?.commandResults ?? []
  const onChunk = options?.onChunk
  const prompts = loadPrompts(
    'reviewer',
    {
      task,
      diff,
      commandResults,
      approvalSchema: ApprovalSchemaJSON,
      rejectionSchema: RejectionJSON,
    },
    cwd,
  )
  const maxTrials = Math.max(prompts.length, 5)

  while (i < maxTrials) {
    try {
      const { data, content } = prompts[i % prompts.length]
      const model = (data as { model?: string })?.model ?? 'auto'

      const args = [
        '--mode', 'plan',
        '--model', model,
        '--output-format', 'stream-json',
        '--stream-partial-output',
        '--print', content,
      ]

      const raw = await runAgentWithStream({
        args,
        spinnerText: 'Running reviewer agent...',
        onChunk,
      })

      const jsonStr = extractJsonObject(raw)
      return ReviewResultSchema.parse(JSON.parse(jsonStr))
    } catch (e) {
      ++i
      console.log(`[runReviewer] trial ${i}/${maxTrials} failed:`, e?.toString())
    }
  }

  throw new Error('Unable to get valid review result.')
}
