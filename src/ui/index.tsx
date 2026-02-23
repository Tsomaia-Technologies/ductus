import React from 'react'
import { render } from 'ink'
import { RunProvider } from './context/RunContext'
import { App } from './App'

export interface RunWithInkOptions {
  feature: string
  maxRetries: number
  tapsRef: { current: any }
  runPipeline: () => Promise<void>
}

/**
 * Renders the Ink UI and runs the pipeline concurrently.
 * Unmounts when the pipeline settles; rethrows if the pipeline fails.
 */
export async function runWithInk(options: RunWithInkOptions): Promise<void> {
  const { feature, maxRetries, tapsRef, runPipeline } = options

  const { waitUntilExit, unmount } = await render(
    <RunProvider feature={feature} maxRetries={maxRetries} tapsRef={tapsRef}>
      <App />
    </RunProvider>,
  )

  runPipeline()
    .then(() => unmount())
    .catch((err) => {
      tapsRef.current?.setError(err?.message ?? String(err))
      tapsRef.current?.setPhase('error')
      unmount()
      throw err
    })

  await waitUntilExit()
}
