import { DuctusKernel } from '../src/core/ductus-kernel.js'
import { TimerProcessor } from './processors/timer-processor.js'
import { DuctusState } from './state/state.js'
import { DuctusMultiplexer } from '../src/core/ductus-multiplexer.js'
import { NodeFileAdapter } from '../src/system/node-file-adapter.js'
import { ductusReducer } from './state/reducer.js'
import { JsonlLedger } from '../src/ledger/jsonl-ledger.js'
import { isCommitedEvent } from '../src/utils/guards.js'
import { DuctusEvent } from './types.js'
import { ConsumerTwoProcessor } from './processors/consumer-two-processor.js'
import { ConsumerOneProcessor } from './processors/consumer-one-processor.js'
import { NodeSystemAdapter } from '../src/system/node-system-adapter.js'
import { DefaultDependencyContainer } from '../src/core/dependency-container.js'

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

  const multiplexer = new DuctusMultiplexer<DuctusEvent>()
  const fileAdapter = new NodeFileAdapter()
  const systemAdapter = new NodeSystemAdapter({
    defaultCwd: '/Users/torniketsomaia/projects/@tsomaia.tech/ductus',
  })
  const ledger = new JsonlLedger<DuctusEvent>({
    fileAdapter,
    ledgerFileAbsolutePath: systemAdapter.resolveAbsolutePath('research/ledger.jsonl'),
    eventGuard: isCommitedEvent as any,
  })
  const kernel = new DuctusKernel<DuctusEvent, DuctusState>({
    initialState,
    reducer: ductusReducer,
    multiplexer,
    ledger,
    processors: [
      new TimerProcessor(),
      new ConsumerOneProcessor(),
      new ConsumerTwoProcessor(),
    ],
    injector: new DefaultDependencyContainer(),
  })

  kernel.boot().then(() => {
    console.log('Kernel booted')
    return kernel.monitor()
  })
}

main().catch(console.error)
