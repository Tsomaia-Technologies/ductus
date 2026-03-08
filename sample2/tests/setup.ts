import Ductus, { FlowBuilder, JsonlLedger, NodeLedgerFileAdapter, NodeSystemAdapter, TemplateRenderer } from 'ductus'
import { fileURLToPath } from 'url'
import path from 'path'
import { render } from '@tsomaiatech/moxite'
import { BlockingMultiplexer } from '../../src/core/multiplexer/blocking-multiplexer.js'
import { DefaultEventSequencer } from '../../src/core/default-event-sequencer.js'

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

export async function runTests<TState>(params: TestRunnerOptions<TState>) {
  const {
    flow,
    dir,
    bufferLimit,
    bufferTimeoutMs,
    overflowStrategy = 'fail',
  } = params
  const system = new NodeSystemAdapter({ defaultCwd: __dirname })
  const fileAdapter = new NodeLedgerFileAdapter()
  const ledger = new JsonlLedger({
    fileAdapter,
    ledgerFileAbsolutePath: system.resolveAbsolutePath(dir, 'ledger.jsonl'),
  })
  const sequencer = new DefaultEventSequencer(ledger)
  const multiplexer = new BlockingMultiplexer(sequencer)
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

  // setInterval(() => {}, 1000) // so that process does not auto-exit
  await kernel.boot()
  await kernel.monitor()
}
