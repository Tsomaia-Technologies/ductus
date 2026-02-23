import { execa } from 'execa'
import type { CommandStatus } from './schema.js'

export interface CommandResult {
  checkId: string
  command: string
  status: 'passed' | 'failed'
  stdout: string
  stderr: string
}

const DEFAULT_CHECKS: Pick<CommandStatus, 'checkId' | 'command' | 'relative_path'>[] = [
  { checkId: 'build', command: 'npm run build', relative_path: '.' },
  { checkId: 'test', command: 'npm test', relative_path: '.' },
]

/**
 * Runs verification commands and returns actual results.
 * Uses engineerReport.checks if available; otherwise runs default checks.
 */
export async function runVerificationCommands(
  checks: CommandStatus[],
  cwd: string,
): Promise<CommandResult[]> {
  const toRun = checks.length > 0 ? checks : DEFAULT_CHECKS

  const results: CommandResult[] = []
  for (const { checkId, command, relative_path } of toRun) {
    const workDir = `${cwd}/${relative_path}`.replace(/\/+$/, '') || cwd
    try {
      const result = await execa('sh', ['-c', command], {
        cwd: workDir,
        reject: false,
      })
      results.push({
        checkId,
        command,
        status: result.exitCode === 0 ? 'passed' : 'failed',
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      })
    } catch (e) {
      results.push({
        checkId,
        command,
        status: 'failed',
        stdout: '',
        stderr: (e as Error)?.toString() ?? 'Unknown error',
      })
    }
  }
  return results
}
