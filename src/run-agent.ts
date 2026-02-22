import { execa } from 'execa'

export type RunAgentWithStreamOptions = {
  args: string[]
  spinnerText?: string
  /**
   * If true, use stream-json format and parse NDJSON to extract assistant text for real-time streaming.
   * If false, use text format (buffered; no streaming but simpler).
   */
  useStreamJson?: boolean
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
  const { args, spinnerText = 'Running agent...', useStreamJson = true } = options

  const { default: ora } = await import('ora')
  const spinner = ora(spinnerText).start()

  const subprocess = execa('agent', args, {
    stdout: 'pipe',
    stderr: 'inherit',
    stdin: 'inherit',
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
            spinner.succeed('Agent started, streaming output...')
          }
          process.stdout.write(text)
          assistantChunks.push(text)
        }
      }
    } else {
      rawChunks.push(chunk)
      if (firstOutput) {
        firstOutput = false
        spinner.succeed('Agent started, streaming output...')
      }
      process.stdout.write(chunk)
    }
  })

  try {
    await subprocess
  } finally {
    if (spinner.isSpinning) {
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
