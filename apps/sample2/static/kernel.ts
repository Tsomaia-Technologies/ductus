import Ductus, {
  DefaultDependencyContainer,
  DuctusMultiplexer,
  JsonlLedger,
  NodeLedgerFileAdapter,
  NodeSystemAdapter,
  TemplateRenderer,
} from 'ductus'
import { render } from '@tsomaiatech/moxite'
import flow from './flow.js'

const system = new NodeSystemAdapter({
  defaultCwd: __dirname,
})
const fileAdapter = new NodeLedgerFileAdapter()
const ledger = new JsonlLedger({
  fileAdapter,
  ledgerFileAbsolutePath: system.resolveAbsolutePath('ledger.jsonl'),
})
const multiplexer = new DuctusMultiplexer({
  ledger,
})
const container = new DefaultDependencyContainer()
const templateRenderer: TemplateRenderer = (template, context) => {
  return render(template, context)
}

export default Ductus.kernel({
  flow,
  multiplexer,
  ledger,
  container,
  systemAdapter: system,
  templateRenderer,
  fileAdapter,
})
