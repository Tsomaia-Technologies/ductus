import * as path from 'path'
import { execa } from 'execa'
import type { CheckProfile } from './ductus-config.js'
import type { RequestedCheck } from './schema.js'

export interface CommandResult {
  checkId: string
  command: string
  status: 'passed' | 'failed'
  stdout: string
  stderr: string
}

/**
 * Runs verification commands from config, filtered by Engineer's requested checkIds.
 * Only runs commands defined in configChecks; requestedChecks selects which to run.
 * Eliminates RCE: commands come from user config, not LLM output.
 */
export async function runVerificationCommands(
  configChecks: CheckProfile[],
  requestedChecks: RequestedCheck[],
  cwd: string,
): Promise<CommandResult[]> {
  const configById = new Map(configChecks.map((c) => [c.id, c]))
  const resolvedCwd = path.resolve(cwd)
  const results: CommandResult[] = []

  for (const req of requestedChecks) {
    const profile = configById.get(req.checkId)
    const runWhen = profile?.run_when ?? 'per_task'
    if (!profile || runWhen !== 'per_task') continue

    const workDir = path.resolve(resolvedCwd, '.')
    const relativeFromCwd = path.relative(resolvedCwd, workDir)
    if (relativeFromCwd.startsWith('..')) {
      results.push({
        checkId: req.checkId,
        command: profile.command,
        status: 'failed',
        stdout: '',
        stderr: `Path traversal rejected for check ${req.checkId}`,
      })
      continue
    }

    try {
      const execResult =
        profile.type === 'scoped' && req.args && req.args.length > 0
          ? await execa(profile.command, req.args, {
              cwd: workDir,
              reject: false,
            })
          : await execa('sh', ['-c', profile.command], {
              cwd: workDir,
              reject: false,
            })
      const exitCode = execResult.exitCode ?? 1
      results.push({
        checkId: req.checkId,
        command: profile.command,
        status: exitCode === 0 ? 'passed' : 'failed',
        stdout: execResult.stdout ?? '',
        stderr: execResult.stderr ?? '',
      })
    } catch (e) {
      results.push({
        checkId: req.checkId,
        command: profile.command,
        status: 'failed',
        stdout: '',
        stderr: (e as Error)?.toString() ?? 'Unknown error',
      })
    }
  }
  return results
}
