import { commitChanges } from './git.js'
import { readDuctusConfig, writeDuctusConfig } from './ductus-config.js'
import { promptCommitFailureRecovery } from './prompt-user.js'

export interface CommitOptions {
  forceAddIgnored?: boolean
}

/**
 * Commits changes. On failure (e.g. hooks), retries with --no-verify per user preference or config.
 * Pass forceAddIgnored to add paths that are in .gitignore (e.g. when running from an ignored dir).
 */
export async function commitWithRetryOnFailure(
  message: string,
  cwd = process.cwd(),
  options?: CommitOptions,
): Promise<void> {
  const forceAddIgnored = options?.forceAddIgnored ?? false
  const config = readDuctusConfig(cwd)
  const effectiveForce = forceAddIgnored || config?.commit?.forceAddIgnored === true

  const attempt = (noVerify: boolean) =>
    commitChanges(message, cwd, { noVerify, force: effectiveForce })

  try {
    await attempt(false)
  } catch (firstError) {
    if (config?.commit?.ignoreHooksOnFailure === true) {
      await attempt(true)
      return
    }

    if (config?.commit?.ignoreHooksOnFailure === false) {
      throw firstError
    }

    const { ignoreHooks, remember } = await promptCommitFailureRecovery()

    if (remember) {
      writeDuctusConfig(cwd, { commit: { ignoreHooksOnFailure: true } })
    }

    if (!ignoreHooks) {
      throw firstError
    }

    await attempt(true)
  }
}
