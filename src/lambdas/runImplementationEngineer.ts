import type { Task } from '../schema'
import type { EngineerReport } from '../schema'
import { EngineerReportSchema, EngineerReportSchemaJSON } from '../schema'
import { loadPrompts } from '../load-prompts'
import { runAgentWithExecutionAndCapture } from '../run-agent'
import { extractLastJsonObject } from '../utils'

const FALLBACK_REPORT: EngineerReport = {
  files_modified: [],
  self_review_status: 'did_not_review_got_lazy',
  checks: [],
  coverage_status: 'got_lazy',
  implementation_status: 'got_lazy',
  implementation_notes: 'Failed to parse EngineerReport from output',
  responsibility_ownership: 'dismiss',
  commitMessage: '',
}

export async function runImplementationEngineer(
  task: Task,
  cwd = process.cwd(),
  options?: { onChunk?: (chunk: string) => void },
): Promise<EngineerReport> {
  const prompts = loadPrompts(
    'implementation-engineer',
    { task, engineerReportSchema: EngineerReportSchemaJSON },
    cwd,
  )

  const { data, content } = prompts[0]
  const model = (data as { model?: string })?.model ?? 'auto'

  const raw = await runAgentWithExecutionAndCapture({
    args: ['--force', '--model', model, '--print', content],
    spinnerText: 'Running implementation engineer...',
    onChunk: options?.onChunk,
  })

  try {
    const jsonStr = extractLastJsonObject(raw)
    return EngineerReportSchema.parse(JSON.parse(jsonStr))
  } catch (e) {
    console.warn('[runImplementationEngineer] Could not parse EngineerReport:', e?.toString())
    return FALLBACK_REPORT
  }
}
