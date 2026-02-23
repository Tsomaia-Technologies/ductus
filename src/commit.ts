import { commitChanges } from './git'
import { readDuctusConfig, writeDuctusConfig } from './ductus-config'
import { promptCommitFailureRecovery } from './prompt-user'

/**
 * Commits changes. On failure (e.g. hooks), retries with --no-verify per user preference or config.
 */
export async function commitWithRetryOnFailure(
  message: string,
  cwd = process.cwd(),
): Promise<void> {
  const attempt = (noVerify: boolean) =>
    commitChanges(message, cwd, { noVerify })

  try {
    await attempt(false)
  } catch (firstError) {
    const config = readDuctusConfig(cwd)

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
