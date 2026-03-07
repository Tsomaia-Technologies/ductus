import Ductus, {
  DuctusMultiplexer,
  JsonlLedger,
  NodeLedgerFileAdapter,
  NodeSystemAdapter,
} from 'ductus'
import flow from './flow.js'
import container from './container.js'
import TemplateRenderer from './TemplateRenderer.js'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const system = new NodeSystemAdapter({ defaultCwd: __dirname })
const fileAdapter = new NodeLedgerFileAdapter()
const ledger = new JsonlLedger({
  fileAdapter,
  ledgerFileAbsolutePath: system.resolveAbsolutePath('ledger.jsonl'),
})
const multiplexer = new DuctusMultiplexer({
  ledger,
})

export default Ductus.kernel({
  flow,
  multiplexer,
  ledger,
  container,
  systemAdapter: system,
  templateRenderer: TemplateRenderer,
  fileAdapter,
})
