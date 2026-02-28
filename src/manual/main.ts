import { DuctusKernel } from './core/ductus-kernel.js'
import { StateProcessor } from './processors/state-processor.js'
import { DuctusState } from './state/state.js'
import { DuctusMultiplexer } from './core/ductus-multiplexer.js'

async function main() {
  const initialState: DuctusState = {
    plansRevisions: {},
    taskBreakdownRevisions: {},
    taskRevisions: {},
    planVerifications: {},
    currentPlanRevisions: {},
    currentTaskBreakdownRevisions: {},
    currentTaskRevisions: {},
    currentPlanVerifications: {},
  }

  const multiplexer = new DuctusMultiplexer()
  const kernel = new DuctusKernel({
    multiplexer,
    processors: [
      new StateProcessor(initialState)
    ],
  })
}

main().catch(console.error)
