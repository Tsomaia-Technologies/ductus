import { ReviewResultSchema } from '../schema.js'
import type { Approval, Rejection } from '../schema.js'
import type { Task } from '../schema.js'
import { ApprovalSchemaJSON, RejectionJSON } from '../schema.js'
import { extractJsonObject } from '../utils.js'
import { loadPrompts } from '../load-prompts.js'
import { runAgentWithStream } from '../run-agent.js'

export async function runReviewer(
  task: Task,
  diff: string,
  cwd = process.cwd(),
  options?: {
    commandResults?: Array<{ checkId: string; command: string; status: string; stdout: string; stderr: string }>
    onChunk?: (chunk: string) => void
    agentPath?: string
    stdin?: 'inherit' | 'ignore'
  },
): Promise<Approval | Rejection> {
  let i = 0
  const commandResults = options?.commandResults ?? []
  const { onChunk, agentPath = 'agent', stdin = 'inherit' } = options ?? {}
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
        agentPath,
        spinnerText: 'Running reviewer agent...',
        onChunk,
        stdin,
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
