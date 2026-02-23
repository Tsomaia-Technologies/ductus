import { execa } from 'execa'

/**
 * Returns the absolute path to the git repository root. Throws if not in a git repo.
 */
export async function getGitRoot(cwd = process.cwd()): Promise<string> {
  const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], { cwd })
  return stdout.trim()
}

/**
 * Returns true if working tree and index are clean (no uncommitted changes).
 */
export async function isWorkingTreeClean(cwd = process.cwd()): Promise<boolean> {
  const { stdout } = await execa('git', ['status', '--porcelain'], { cwd })
  return stdout.trim().length === 0
}

/**
 * Returns the current HEAD commit hash. Throws if not in a git repo.
 */
export async function getHeadRef(cwd = process.cwd()): Promise<string> {
  const { stdout } = await execa('git', ['rev-parse', 'HEAD'], { cwd })
  return stdout.trim()
}

/**
 * Returns the diff from the given ref to the working tree (uncommitted changes).
 * Use this after Engineer runs, since we do not commit—changes exist only in the working tree.
 */
export async function getDiff(
  fromRef: string,
  cwd = process.cwd(),
): Promise<string> {
  const { stdout } = await execa('git', ['diff', fromRef, '--', '.'], {
    cwd,
  })
  return stdout
}

/**
 * Reverts working tree and index to the given ref. Use when retrying a failed task from clean state.
 * Also runs `git clean -fd` to remove untracked files created during the failed attempt.
 */
export async function revertToRef(ref: string, cwd = process.cwd()): Promise<void> {
  await execa('git', ['reset', '--hard', ref], { cwd })
  await execa('git', ['clean', '-fd'], { cwd })
}

/**
 * Stages all changes and creates a commit. Runs from the git repo root.
 * Optionally skips hooks via --no-verify; use force to add ignored paths.
 */
export async function commitChanges(
  message: string,
  cwd = process.cwd(),
  options?: { noVerify?: boolean; force?: boolean },
): Promise<void> {
  const root = await getGitRoot(cwd)
  const addArgs = options?.force ? ['add', '-f', '--', '.'] : ['add', '--', '.']
  await execa('git', addArgs, { cwd: root })
  const args = ['commit', '-m', message]
  if (options?.noVerify) args.push('--no-verify')
  await execa('git', args, { cwd: root })
}
