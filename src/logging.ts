import * as fs from 'fs'
import * as path from 'path'

let logFilePath: string | null = null

export function initLogger(cwd: string, feature: string): void {
  const dir = path.join(cwd, '.ductus', feature)
  fs.mkdirSync(dir, { recursive: true })
  logFilePath = path.join(dir, 'debug.log')
  fs.appendFileSync(
    logFilePath,
    `\n\n=== NEW RUN STARTED: ${new Date().toISOString()} ===\n`,
  )
}

export function log(category: string, message: string, data?: unknown): void {
  if (!logFilePath) return

  const timestamp = new Date().toISOString()
  let entry = `[${timestamp}] [${category}] ${message}`
  if (data !== undefined) {
    if (typeof data === 'string') {
      entry += `\n${data}`
    } else {
      try {
        entry += `\n${JSON.stringify(data, null, 2)}`
      } catch {
        entry += `\n[Could not serialize data]`
      }
    }
  }

  fs.appendFileSync(logFilePath, entry + '\n')
}
