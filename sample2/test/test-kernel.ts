import Ductus, {
    DefaultDependencyContainer,
    DuctusMultiplexer,
    JsonlLedger,
    NodeLedgerFileAdapter,
    NodeSystemAdapter,
    TemplateRenderer,
} from 'ductus'
import { render } from '@tsomaiatech/moxite'
import flow from './test-flow.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const system = new NodeSystemAdapter({
    defaultCwd: path.join(__dirname, '../static/skills'),
})
const fileAdapter = new NodeLedgerFileAdapter()
const ledger = new JsonlLedger({
    fileAdapter,
    ledgerFileAbsolutePath: path.join(__dirname, 'test-ledger.jsonl'),
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
