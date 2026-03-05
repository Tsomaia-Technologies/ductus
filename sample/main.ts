import {
  DefaultDependencyContainer,
  DuctusKernel,
  DuctusMultiplexer,
  isCommitedEvent,
  JsonlLedger,
  NodeFileAdapter,
  NodeFileHandleAdapter,
  NodeSystemAdapter,
} from 'ductus'
import { TimerProcessor } from './processors/timer-processor.js'
import { DuctusState } from './state/state.js'
import { ductusReducer } from './state/reducer.js'
import { DuctusEvent } from './types.js'
import { ConsumerTwoProcessor } from './processors/consumer-two-processor.js'
import { ConsumerOneProcessor } from './processors/consumer-one-processor.js'

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
  const fileHandleAdapter = new NodeFileHandleAdapter()
  const systemAdapter = new NodeSystemAdapter({
    defaultCwd: '/Users/torniketsomaia/projects/@tsomaia.tech/ductus',
  })
  const ledger = new JsonlLedger<DuctusEvent>({
    fileAdapter,
    fileHandleAdapter,
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
