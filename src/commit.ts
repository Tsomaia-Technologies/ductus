import { commitChanges } from './git.js'
import { readDuctusConfig, writeDuctusConfig } from './ductus-config.js'
import {
  promptCommitFailureRecovery,
  promptCommitForceAddRecovery,
} from './prompt-user.js'

export interface CommitOptions {
  forceAddIgnored?: boolean
}

function isIgnoredPathsError(err: unknown): boolean {
  const msg = String((err as { stderr?: string; message?: string })?.stderr ?? (err as Error)?.message ?? '')
  return /ignored|\.gitignore/i.test(msg)
}

/**
 * Commits changes. On failure (e.g. hooks), retries with --no-verify per user preference or config.
 * On ignored-paths failure, prompts to retry with --force-add and optionally remember.
 */
export async function commitWithRetryOnFailure(
  message: string,
  cwd = process.cwd(),
  options?: CommitOptions,
): Promise<void> {
  let effectiveForce = options?.forceAddIgnored ?? false
  const config = readDuctusConfig(cwd)
  effectiveForce = effectiveForce || config?.commit?.forceAddIgnored === true

  const attempt = (noVerify: boolean, force: boolean) =>
    commitChanges(message, cwd, { noVerify, force })

  try {
    await attempt(false, effectiveForce)
  } catch (firstError) {
    if (isIgnoredPathsError(firstError)) {
      if (config?.commit?.forceAddIgnored === true) {
        throw firstError
      }
      if (config?.commit?.forceAddIgnored === false) {
        throw firstError
      }
      const { retryWithForce, remember } = await promptCommitForceAddRecovery()
      if (remember) {
        writeDuctusConfig(cwd, { commit: { forceAddIgnored: true } })
      }
      if (retryWithForce) {
        await attempt(false, true)
        return
      }
      throw firstError
    }

    if (config?.commit?.ignoreHooksOnFailure === true) {
      await attempt(true, effectiveForce)
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

    await attempt(true, effectiveForce)
  }
}
