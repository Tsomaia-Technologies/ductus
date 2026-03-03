import {
    TransportEntity,
    TransportProcessOptions,
} from '../interfaces/entities/transport-entity.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { AgentContext } from '../interfaces/agent-context.js'
import { NodeSystemAdapter } from '../system/node-system-adapter.js'
import { SystemProcessAdapter } from '../interfaces/system-process-adapter.js'

export interface CliTransportConfig {
    command: string
    args: string[]
    cwd: string
    env: Record<string, string | undefined>
    timeoutMs?: number
}

export class CliTransport implements TransportEntity {
    private agent: AgentEntity | null = null
    private model: ModelEntity | null = null
    private context: AgentContext | undefined
    private processAdapter: SystemProcessAdapter | null = null

    constructor(private readonly config: CliTransportConfig) {}

    async initialize(
        _agent: AgentEntity,
        _model: ModelEntity,
        _context?: AgentContext,
    ): Promise<void> {
        if (this.processAdapter) {
            throw new Error('Transport already initialized.')
        }

        this.agent = _agent
        this.model = _model
        this.context = _context

        const { command, args, cwd, env, timeoutMs } = this.config

        const systemAdapter = new NodeSystemAdapter({
            defaultCwd: cwd,
            defaultEnv: env as Record<string, string>,
        })

        this.processAdapter = systemAdapter.spawn(command, args, {
            cwd,
            env: env as Record<string, string>,
            timeoutMs,
        })
    }

    async process(input: string, options: TransportProcessOptions): Promise<void> {
        if (!this.processAdapter) {
            throw new Error(
                'Transport not initialized. Call initialize() first.',
            )
        }

        const canceller = options.canceller
        if (canceller) {
            canceller.onCancel(() => {
                this.processAdapter?.gracefullyShutdown({ drain: true })
            })
        }

        await this.processAdapter.write(input)
    }
}
