import type { Task } from '../schema.js'
import type { EngineerReport } from '../schema.js'
import { EngineerReportSchema, EngineerReportSchemaJSON } from '../schema.js'
import { loadPrompts } from '../load-prompts.js'
import { runAgentWithExecutionAndCapture } from '../run-agent.js'
import { extractLastJsonObject } from '../utils.js'

const FALLBACK_REPORT: EngineerReport = {
  files_modified: [],
  self_review_status: 'did_not_review_got_lazy',
  requested_checks: [],
  coverage_status: 'got_lazy',
  implementation_status: 'got_lazy',
  implementation_notes: 'Failed to parse EngineerReport from output',
  responsibility_ownership: 'dismiss',
  commitMessage: '',
}

export async function runImplementationEngineer(
  task: Task,
  cwd = process.cwd(),
  options?: {
    onChunk?: (chunk: string) => void
    availableCheckIds?: string[]
    agentPath?: string
    stdin?: 'inherit' | 'ignore'
  },
): Promise<EngineerReport> {
  const { availableCheckIds = [], agentPath = 'agent', stdin = 'inherit' } = options ?? {}
  const prompts = loadPrompts(
    'implementation-engineer',
    { task, engineerReportSchema: EngineerReportSchemaJSON, availableCheckIds },
    cwd,
  )

  const { data, content } = prompts[0]
  const model = (data as { model?: string })?.model ?? 'auto'

  const raw = await runAgentWithExecutionAndCapture({
    args: ['--force', '--model', model, '--print', content],
    agentPath,
    spinnerText: 'Running implementation engineer...',
    onChunk: options?.onChunk,
    stdin,
  })

  try {
    const jsonStr = extractLastJsonObject(raw)
    return EngineerReportSchema.parse(JSON.parse(jsonStr))
  } catch (e) {
    console.warn('[runImplementationEngineer] Could not parse EngineerReport:', e?.toString())
    return FALLBACK_REPORT
  }
}
