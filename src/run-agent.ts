import { execa } from 'execa'

/** Strip ANSI escape codes (avoids ESM strip-ansi in CJS build). */
function stripAnsi(str: string): string {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  )
}

export type RunAgentWithStreamOptions = {
  args: string[]
  spinnerText?: string
  /**
   * If true, use stream-json format and parse NDJSON to extract assistant text for real-time streaming.
   * If false, use text format (buffered; no streaming but simpler).
   */
  useStreamJson?: boolean
  /** When set, route output here instead of process.stdout; skips ora spinner. Use for Ink UI. */
  onChunk?: (chunk: string) => void
  /** Stdin mode. Use 'ignore' for non-interactive runs (architect, refinement) to avoid competing with Ink UI. */
  stdin?: 'inherit' | 'ignore' | 'pipe'
}

function extractAssistantTextFromStreamJson(line: string): string | null {
  try {
    const event = JSON.parse(line) as { type?: string; message?: { content?: Array<{ type?: string; text?: string }> } }
    if (event.type === 'assistant' && event.message?.content?.[0]?.text) {
      return event.message.content[0].text
    }
  } catch {
    // Not valid JSON or wrong shape
  }
  return null
}

/**
 * Runs the agent with a loading spinner until the first output chunk, then streams
 * output to the terminal while buffering it for the caller. Returns the full assistant
 * text (for stream-json) or raw stdout (for text).
 */
export async function runAgentWithStream(
  options: RunAgentWithStreamOptions,
): Promise<string> {
  const { args, spinnerText = 'Running agent...', useStreamJson = true, onChunk, stdin = 'inherit' } = options

  const write = onChunk
    ? (text: string) => {
        onChunk(stripAnsi(text))
      }
    : (text: string) => {
        process.stdout.write(text)
      }

  const { default: ora } = await import('ora')
  const spinner = onChunk ? null : ora(spinnerText).start()

  const subprocess = execa('agent', args, {
    stdout: 'pipe',
    stderr: 'inherit',
    stdin,
  })

  const assistantChunks: string[] = []
  const rawChunks: Buffer[] = []
  let lineBuffer = ''
  let firstOutput = true

  subprocess.stdout?.on('data', (chunk: Buffer) => {
    if (useStreamJson) {
      const str = chunk.toString('utf-8')
      lineBuffer += str
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        const text = extractAssistantTextFromStreamJson(line)
        if (text) {
          if (firstOutput) {
            firstOutput = false
            spinner?.succeed('Agent started, streaming output...')
          }
          write(text)
          assistantChunks.push(text)
        }
      }
    } else {
      rawChunks.push(chunk)
      if (firstOutput) {
        firstOutput = false
        spinner?.succeed('Agent started, streaming output...')
      }
      write(chunk.toString('utf-8'))
    }
  })

  try {
    await subprocess
  } finally {
    if (spinner?.isSpinning) {
      spinner.stop()
    }
  }

  if (useStreamJson) {
    if (lineBuffer.trim()) {
      const text = extractAssistantTextFromStreamJson(lineBuffer)
      if (text) assistantChunks.push(text)
    }
    return assistantChunks.join('')
  }

  return Buffer.concat(rawChunks).toString('utf-8')
}

/**
 * Runs the agent with stdio inherit (or pipes to onChunk when provided).
 * Used for Engineer/Remediation phases. When onChunk is set, stdout is piped to it.
 */
export async function runAgentWithExecution(options: {
  args: string[]
  onChunk?: (chunk: string) => void
}): Promise<void> {
  const { args, onChunk } = options
  if (onChunk) {
    const subprocess = execa('agent', args, {
      stdout: 'pipe',
      stderr: 'inherit',
      stdin: 'inherit',
    })
    subprocess.stdout?.on('data', (chunk: Buffer) => {
      onChunk(stripAnsi(chunk.toString('utf-8')))
    })
    await subprocess
  } else {
    await execa('agent', args, {
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit',
    })
  }
}

/**
 * Runs the agent with execution mode, piping stdout to the terminal while buffering it.
 * Returns the raw stdout for parsing (e.g. EngineerReport JSON at end of turn).
 */
export async function runAgentWithExecutionAndCapture(options: {
  args: string[]
  spinnerText?: string
  onChunk?: (chunk: string) => void
}): Promise<string> {
  const { args, spinnerText, onChunk } = options
  const { default: ora } = await import('ora')
  const spinner = onChunk ? null : spinnerText ? ora(spinnerText).start() : null

  const subprocess = execa('agent', args, {
    stdout: 'pipe',
    stderr: 'inherit',
    stdin: 'inherit',
  })

  const chunks: Buffer[] = []
  subprocess.stdout?.on('data', (chunk: Buffer) => {
    chunks.push(chunk)
    if (onChunk) {
      onChunk(stripAnsi(chunk.toString('utf-8')))
    } else {
      process.stdout.write(chunk)
    }
    if (spinner?.isSpinning) spinner.succeed('Agent started...')
  })

  try {
    await subprocess
  } finally {
    if (spinner?.isSpinning) spinner.stop()
  }

  return Buffer.concat(chunks).toString('utf-8')
}
