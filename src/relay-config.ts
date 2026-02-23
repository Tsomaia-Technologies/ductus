import * as fs from 'fs'
import * as path from 'path'

export type RelayConfig = {
  commit?: { ignoreHooksOnFailure?: boolean }
}

const CONFIG_FILENAME = 'config.json'

/**
 * Reads .relay/config.json from the project. Returns null if missing or invalid.
 */
export function readRelayConfig(cwd = process.cwd()): RelayConfig | null {
  const configPath = path.join(cwd, '.relay', CONFIG_FILENAME)
  if (!fs.existsSync(configPath)) return null
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(raw) as RelayConfig
  } catch {
    return null
  }
}

/**
 * Merges the given commit options into the config and writes back.
 * Preserves other top-level keys. Creates .relay/ if needed.
 */
export function writeRelayConfig(
  cwd: string,
  options: { commit: { ignoreHooksOnFailure: boolean } },
): void {
  const relayDir = path.join(cwd, '.relay')
  const configPath = path.join(relayDir, CONFIG_FILENAME)

  let existing: Record<string, unknown> = {}
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8')
      existing = JSON.parse(raw) as Record<string, unknown>
    } catch {
      // Overwrite on parse error
    }
  }

  const merged = {
    ...existing,
    commit: {
      ...(existing.commit && typeof existing.commit === 'object'
        ? (existing.commit as Record<string, unknown>)
        : {}),
      ...options.commit,
    },
  }

  fs.mkdirSync(relayDir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8')
}
