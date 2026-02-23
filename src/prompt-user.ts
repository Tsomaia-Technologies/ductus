import * as readline from 'readline'
import type { Task } from './schema.js'

/**
 * Displays numbered task summaries and prompts the user to accept or request changes.
 * Returns null if user accepts (Enter or empty input), or the trimmed feedback string.
 */
export function promptForTaskApproval(tasks: Task[]): Promise<string | null> {
  return new Promise((resolve) => {
    for (const [i, task] of tasks.entries()) {
      console.log(`${i + 1}. ${task.summary}`)
    }
    console.log('')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(
      'Accept these tasks? (press Enter to accept, or describe changes): ',
      (answer) => {
        rl.close()
        const trimmed = answer?.trim() ?? ''
        resolve(trimmed === '' ? null : trimmed)
      },
    )
  })
}

/**
 * Prompts the user when commit fails due to ignored paths. Asks whether to
 * retry with --force-add, and optionally to remember for future runs.
 */
export function promptCommitForceAddRecovery(): Promise<{
  retryWithForce: boolean
  remember: boolean
}> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    const askQ1 = () => {
      rl.question(
        'Commit failed (paths ignored by .gitignore). Retry with --force-add? (y/n): ',
        (q1) => {
          const yes = /^y(es)?$/i.test(q1?.trim() ?? '')
          if (!yes) {
            rl.close()
            resolve({ retryWithForce: false, remember: false })
            return
          }
          askQ2()
        },
      )
    }

    const askQ2 = () => {
      rl.question(
        'Remember this decision for future runs? (y/n): ',
        (q2) => {
          rl.close()
          const remember = /^y(es)?$/i.test(q2?.trim() ?? '')
          resolve({ retryWithForce: true, remember })
        },
      )
    }

    askQ1()
  })
}

/**
 * Prompts the user when commit fails. Asks whether to ignore hooks and retry,
 * and optionally to remember the decision for future runs.
 */
export function promptCommitFailureRecovery(): Promise<{
  ignoreHooks: boolean
  remember: boolean
}> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    const askQ1 = () => {
      rl.question(
        'Commit failed (likely due to hooks). Ignore hooks and commit anyway? (y/n): ',
        (q1) => {
          const yes = /^y(es)?$/i.test(q1?.trim() ?? '')
          if (!yes) {
            rl.close()
            resolve({ ignoreHooks: false, remember: false })
            return
          }
          askQ2()
        },
      )
    }

    const askQ2 = () => {
      rl.question(
        'Remember this decision for future runs? (y/n): ',
        (q2) => {
          rl.close()
          const remember = /^y(es)?$/i.test(q2?.trim() ?? '')
          resolve({ ignoreHooks: true, remember })
        },
      )
    }

    askQ1()
  })
}
