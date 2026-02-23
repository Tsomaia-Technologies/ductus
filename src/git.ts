import { execa } from 'execa'

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
 * Stages all changes and creates a commit. Optionally skips hooks via --no-verify.
 */
export async function commitChanges(
  message: string,
  cwd = process.cwd(),
  options?: { noVerify?: boolean },
): Promise<void> {
  await execa('git', ['add', '--', '.'], { cwd })
  const args = ['commit', '-m', message]
  if (options?.noVerify) args.push('--no-verify')
  await execa('git', args, { cwd })
}
