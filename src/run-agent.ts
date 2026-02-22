import { execa } from 'execa'

export type RunAgentWithStreamOptions = {
  args: string[]
  spinnerText?: string
}

/**
 * Runs the agent with a loading spinner until the first output chunk, then streams
 * stdout to the terminal while buffering it for the caller. Returns the full stdout.
 */
export async function runAgentWithStream(
  options: RunAgentWithStreamOptions,
): Promise<string> {
  const { args, spinnerText = 'Running agent...' } = options

  const { default: ora } = await import('ora')
  const spinner = ora(spinnerText).start()

  const subprocess = execa('agent', args, {
    stdout: 'pipe',
    stderr: 'inherit',
    stdin: 'inherit',
  })

  const chunks: Buffer[] = []
  let firstChunk = true

  subprocess.stdout?.on('data', (chunk: Buffer) => {
    if (firstChunk) {
      firstChunk = false
      spinner.succeed('Agent started, streaming output...')
    }
    process.stdout.write(chunk)
    chunks.push(chunk)
  })

  try {
    await subprocess
  } finally {
    if (spinner.isSpinning) {
      spinner.stop()
    }
  }

  return Buffer.concat(chunks).toString('utf-8')
}
