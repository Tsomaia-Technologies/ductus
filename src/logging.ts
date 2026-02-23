import * as fs from 'fs'
import * as path from 'path'
import fss from 'fast-safe-stringify'

/** Safe stringify that handles circular refs (fast-safe-stringify default export). */
const safeStringify = (fss as unknown) as (value: unknown, replacer?: unknown, space?: number) => string

let logFilePath: string | null = null
let logStream: fs.WriteStream | null = null

export function initLogger(cwd: string, feature: string): void {
  try {
    const dir = path.join(cwd, '.ductus', feature)
    fs.mkdirSync(dir, { recursive: true })
    logFilePath = path.join(dir, 'debug.log')
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' })
    logStream.write(`\n\n=== NEW RUN STARTED: ${new Date().toISOString()} ===\n`, (err) => {
      if (err) process.stderr.write(`[ductus] Log init write failed: ${err.message}\n`)
    })
  } catch (err) {
    process.stderr.write(`[ductus] Log init failed: ${(err as Error)?.message ?? err}\n`)
    logFilePath = null
  }
}

export function closeLogger(): void {
  if (logStream) {
    logStream.end()
    logStream = null
  }
  logFilePath = null
}

export function log(category: string, message: string, data?: unknown): void {
  try {
    if (!logStream || !logFilePath) return

    const timestamp = new Date().toISOString()
    let entry = `[${timestamp}] [${category}] ${message}`
    if (data !== undefined) {
      if (typeof data === 'string') {
        entry += `\n${data}`
      } else {
        entry += `\n${safeStringify(data, null, 2)}`
      }
    }

    logStream.write(entry + '\n', (err) => {
      if (err) process.stderr.write(`[ductus] Log write failed: ${err.message}\n`)
    })
  } catch {
    // Never let the logger crash the app
  }
}
