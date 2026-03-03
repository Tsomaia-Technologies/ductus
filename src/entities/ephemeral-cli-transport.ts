import {
    TransportEntity,
    TransportProcessOptions,
} from '../interfaces/entities/transport-entity.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { AgentContext } from '../interfaces/agent-context.js'
import { NodeSystemAdapter } from '../system/node-system-adapter.js'
import { CliTransportConfig } from './cli-transport.js'

export class EphemeralCliTransport implements TransportEntity {
    private agent: AgentEntity | null = null
    private model: ModelEntity | null = null
    private context: AgentContext | undefined

    constructor(private readonly config: CliTransportConfig) {}

    async initialize(
        agent: AgentEntity,
        model: ModelEntity,
        context?: AgentContext,
    ): Promise<void> {
        this.agent = agent
        this.model = model
        this.context = context
    }

    async process(
        input: string,
        options: TransportProcessOptions,
    ): Promise<void> {
        if (!this.model) {
            throw new Error(
                'Transport not initialized. Call initialize() first.',
            )
        }

        const { command, args, cwd, env, timeoutMs } = this.config
        const resolvedEnv: Record<string, string> = {
            ...Object.fromEntries(
                Object.entries(env).filter(
                    (entry): entry is [string, string] =>
                        entry[1] !== undefined,
                ),
            ),
            DUCTUS_MODEL: JSON.stringify(this.model),
            DUCTUS_CONTEXT: JSON.stringify(
                this.context ?? {
                    messages: [],
                    stats: { inputTokens: 0, outputTokens: 0, turns: 0 },
                },
            ),
        }
        if (this.agent) {
            resolvedEnv.DUCTUS_AGENT = JSON.stringify(this.agent)
        }

        const systemAdapter = new NodeSystemAdapter({
            defaultCwd: cwd,
            defaultEnv: resolvedEnv,
        })

        const processAdapter = systemAdapter.spawn(command, args, {
            cwd,
            env: resolvedEnv,
            timeoutMs,
            canceller: options.canceller,
        })

        if (options.canceller) {
            options.canceller.onCancel(() => {
                processAdapter.gracefullyShutdown({ drain: true })
            })
        }

        await processAdapter.write(input, { end: true })

        for await (const event of processAdapter.readStream()) {
            if (event.type === 'exit') break
        }
    }
}
