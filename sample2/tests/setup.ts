import Ductus, {
  DuctusMultiplexer, FlowBuilder,
  JsonlLedger,
  NodeLedgerFileAdapter,
  NodeSystemAdapter, TemplateRenderer,
} from 'ductus'
import { fileURLToPath } from 'url'
import path from 'path'
import { render } from '@tsomaiatech/moxite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const templateRenderer: TemplateRenderer = (template, context) => {
  return render(template, context)
}

const container = Ductus.container()

export async function runTests(flow: FlowBuilder<any>, subPath: string) {
  const system = new NodeSystemAdapter({ defaultCwd: __dirname })
  const fileAdapter = new NodeLedgerFileAdapter()
  const ledger = new JsonlLedger({
    fileAdapter,
    ledgerFileAbsolutePath: system.resolveAbsolutePath(subPath, 'ledger.jsonl'),
  })
  const multiplexer = new DuctusMultiplexer({
    ledger,
  })
  const kernel = Ductus.kernel({
    flow,
    multiplexer,
    ledger,
    container,
    systemAdapter: system,
    templateRenderer,
    fileAdapter,
  })

  await kernel.boot()
  await kernel.monitor()
}
