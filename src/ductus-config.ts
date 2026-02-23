import * as fs from 'fs'
import * as path from 'path'

export type DuctusConfig = {
  commit?: { ignoreHooksOnFailure?: boolean; forceAddIgnored?: boolean }
}

const CONFIG_FILENAME = 'config.json'

/**
 * Reads .ductus/config.json from the project. Returns null if missing or invalid.
 */
export function readDuctusConfig(cwd = process.cwd()): DuctusConfig | null {
  const configPath = path.join(cwd, '.ductus', CONFIG_FILENAME)
  if (!fs.existsSync(configPath)) return null
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(raw) as DuctusConfig
  } catch {
    return null
  }
}

/**
 * Merges the given commit options into the config and writes back.
 * Preserves other top-level keys. Creates .ductus/ if needed.
 */
export function writeDuctusConfig(
  cwd: string,
  options: {
    commit: Partial<{
      ignoreHooksOnFailure: boolean
      forceAddIgnored: boolean
    }>
  },
): void {
  const ductusDir = path.join(cwd, '.ductus')
  const configPath = path.join(ductusDir, CONFIG_FILENAME)

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

  fs.mkdirSync(ductusDir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8')
}
