import Ductus, {
  FailFirstMultiplexer,
  FlowBuilder,
  JsonlLedger,
  NodeLedgerFileAdapter,
  NodeSystemAdapter,
  TemplateRenderer, ThrottleMultiplexer,
} from 'ductus'
import { fileURLToPath } from 'url'
import path from 'path'
import { render } from '@tsomaiatech/moxite'
import { BlockingMultiplexer } from '../../src/core/multiplexer/blocking-multiplexer.js'
import { DefaultEventSequencer } from '../../src/core/default-event-sequencer.js'
import { EventSequencer } from '../../src/interfaces/event-sequencer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const templateRenderer: TemplateRenderer = (template, context) => {
  return render(template, context)
}

const container = Ductus.container()

export interface TestRunnerOptions<TState> {
  flow: FlowBuilder<TState>
  dir: string
  bufferLimit?: number
  bufferTimeoutMs?: number
  overflowStrategy?: 'fail' | 'block' | 'throttle'
}

function createMultiplexer<TState>(params: TestRunnerOptions<TState> & {
  sequencer: EventSequencer
}) {
  const {
    bufferLimit = 100,
    bufferTimeoutMs,
    overflowStrategy = 'fail',
    sequencer,
  } = params

  switch (overflowStrategy) {
    case 'block':
      return new BlockingMultiplexer(sequencer)

    case 'fail':
      return new FailFirstMultiplexer({
        maxQueueSize: bufferLimit,
        sequencer,
      })

    case 'throttle':
      return new ThrottleMultiplexer({
        sequencer,
        highWaterMark: bufferLimit,
        stallTimeoutMs: bufferTimeoutMs,
      })

    default:
      throw new Error(`Unsupported overflowStrategy: ${overflowStrategy}`)
  }
}

export async function runTests<TState>(params: TestRunnerOptions<TState>) {
  const { flow, dir } = params
  const system = new NodeSystemAdapter({ defaultCwd: __dirname })
  const fileAdapter = new NodeLedgerFileAdapter()
  const ledger = new JsonlLedger({
    fileAdapter,
    ledgerFileAbsolutePath: system.resolveAbsolutePath(dir, 'ledger.jsonl'),
  })
  const sequencer = new DefaultEventSequencer(ledger)
  const multiplexer = createMultiplexer({
    ...params,
    sequencer,
  })
  const kernel = Ductus.kernel({
    flow,
    multiplexer,
    sequencer,
    ledger,
    container,
    systemAdapter: system,
    templateRenderer,
    fileAdapter,
  })

  const ledgerPath = system.resolveAbsolutePath(dir, 'ledger.jsonl')
  await fileAdapter.delete(ledgerPath)

  // setInterval(() => {}, 1000) // so that process does not auto-exit
  await kernel.boot()
  await kernel.monitor()
}
