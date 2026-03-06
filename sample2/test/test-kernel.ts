import Ductus, {
    DefaultDependencyContainer,
    DuctusMultiplexer,
    JsonlLedger,
    NodeFileAdapter,
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
const fileAdapter = new NodeFileAdapter()
const ledger = new JsonlLedger({
    fileAdapter: fileAdapter as any, // Cast to any to satisfy the LedgerFileAdapter interface which NodeFileAdapter now implements but TS might be laggy
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
