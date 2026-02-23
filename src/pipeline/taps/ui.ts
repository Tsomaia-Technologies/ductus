import type { Task } from '../../schema.js'
import type { PipelineContext, PipelineTaps, RunPhase } from '../context.js'
import { createPersistTap } from './persistence.js'
import { promptForTaskApproval } from '../../prompt-user.js'

/**
 * Stub UI taps that bridge the pipeline to existing readline/ora-style output.
 * Prepares for the eventual Ink swap; for now uses console and stdout.
 */
export function createStubTaps(): PipelineTaps {
  const persistTap = createPersistTap()

  return {
    setPhase(phase: RunPhase): void {
      console.log(`[ductus] Phase: ${phase}`)
    },

    appendStream(chunk: string): void {
      if (chunk) process.stdout.write(chunk)
    },

    setStreamActive(_active: boolean): void {
      // No-op: current flow has no stream panel; Ora handles spinner.
    },

    setError(err: string | null): void {
      if (err) console.error('[ductus]', err)
    },

    persistTasks(ctx: PipelineContext): void {
      persistTap(ctx)
    },

    promptTaskApproval(tasks: Task[]): Promise<string | null> {
      return promptForTaskApproval(tasks)
    },
    setCurrentTask: undefined,
    setTasks: undefined,
  }
}
