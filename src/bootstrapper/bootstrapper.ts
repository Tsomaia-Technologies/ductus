import type { DuctusConfig } from "../core/ductus-config-schema.js";
import { MultiplexerHub } from "../core/multiplexer-hub.js";
import { StateMachineProcessor } from "../processors/state-machine-processor.js";
import { AsyncEventQueue, RingBufferQueue } from "../core/event-queue.js";
import type { BaseEvent, CommittedEvent } from "../interfaces/event.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import {
    createSessionProcessor,
    createPlanningProcessor,
    createTaskingProcessor,
    createDevelopmentProcessor,
    createQualityProcessor,
    createAgentProcessor,
    createToolProcessor,
    createTelemetryProcessor
} from "../processors/stub-processors.js";
import { PersistenceProcessor } from "../processors/persistence-processor.js";
import { LoggerProcessor } from "../processors/logger-processor.js";
import type { FileAdapter, OSAdapter, TerminalAdapter } from "../interfaces/adapters.js";
import type { AgentDispatcher } from "../interfaces/agent-dispatcher.js";
import type { CacheAdapter } from "../interfaces/cache-adapter.js";

export interface BootstrapperDependencies {
    configPath: string;
    ledgerPath: string;
    cwd: string;
    fileAdapter: FileAdapter;
    osAdapter: OSAdapter;
    terminalAdapter: TerminalAdapter;
    agentDispatcher?: AgentDispatcher;
    cacheAdapter?: CacheAdapter;
    config?: DuctusConfig;
}

export class Bootstrapper {
    private hub: MultiplexerHub;
    private stateMachine: StateMachineProcessor;
    private processors: EventProcessor[] = [];
    private abortController = new AbortController();

    constructor(private readonly deps: BootstrapperDependencies) {
        this.hub = new MultiplexerHub();
        this.stateMachine = new StateMachineProcessor();
    }

    /**
     * Wires up the DI graph and begins orchestrating pure streams.
     */
    public async boot(mode: "new" | "resume"): Promise<void> {
        // 1. Instantiate all edge processors
        this.instantiateProcessors();

        // 2. Wire the primary Hub -> StateMachine stream
        this.wireProcessor(this.stateMachine);

        // 3. Wire all Edge Processors
        for (const processor of this.processors) {
            this.wireProcessor(processor);
        }

        // 4. In "resume" mode, hydrate the ledger and replay states. In "new" mode, seed basic events.
        if (mode === "resume") {
            await this.replayLedger();
        } else {
            this.hub.broadcast({
                type: "SYSTEM_START",
                payload: { mode: "new" },
                authorId: "bootstrapper",
                timestamp: Date.now(),
                volatility: "durable"
            });
        }
    }

    /**
     * Gracefully shuts down the entire architecture.
     */
    public shutdown(): void {
        this.abortController.abort();
        this.hub.close();
    }

    private instantiateProcessors(): void {
        const { deps } = this;

        // We instantiate full implementations where possible, falling back to stubs.
        this.processors.push(new PersistenceProcessor(deps.fileAdapter, deps.ledgerPath));
        this.processors.push(new LoggerProcessor(deps.terminalAdapter));

        this.processors.push(createSessionProcessor()); // Stub
        this.processors.push(createPlanningProcessor()); // Stub
        this.processors.push(createTaskingProcessor()); // Stub
        this.processors.push(createDevelopmentProcessor({ config: deps.config, cwd: deps.cwd }));
        this.processors.push(createQualityProcessor({ config: deps.config, cwd: deps.cwd }));

        this.processors.push(createAgentProcessor({
            config: deps.config,
            dispatcher: deps.agentDispatcher,
            fileAdapter: deps.fileAdapter,
            cacheAdapter: deps.cacheAdapter,
            cwd: deps.cwd
        }));

        this.processors.push(createToolProcessor({
            osAdapter: deps.osAdapter,
            cwd: deps.cwd
        }));

        this.processors.push(createTelemetryProcessor()); // Stub
    }

    private wireProcessor(processor: EventProcessor): void {
        const inputStream = this.hub.subscribe();
        const outputStream = processor.process(inputStream);

        (async () => {
            for await (const outEvent of outputStream) {
                if (this.abortController.signal.aborted) break;
                this.hub.broadcast(outEvent);
            }
        })().catch(console.error);
    }

    private async replayLedger(): Promise<void> {
        try {
            const logs = await this.deps.fileAdapter.read(this.deps.ledgerPath);
            const lines = logs.split("\n").filter(Boolean);
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line) as CommittedEvent;
                    parsed.isReplay = true;
                    this.hub.injectReplay(parsed);
                } catch (e) {
                    // Ignore parse errors from corrupted lines
                }
            }
        } catch (e) {
            // Ledger might not exist yet
        }

        this.hub.broadcast({
            type: "SYSTEM_START",
            payload: { mode: "resume" },
            authorId: "bootstrapper",
            timestamp: Date.now(),
            volatility: "durable"
        });
    }
}
