/**
 * Bootstrapper - Single Source of DI Truth.
 * Builds the engine, wires Hub to adapters and 10 Processors.
 * Handles Replay Hydration and LiveMode flip.
 * RFC-001 Task 008, Impl Guide Phase 2.
 */

import { join } from "node:path";
import type { CommitedEvent } from "../core/event-contracts.js";
import type { FileAdapter, OSAdapter, TerminalAdapter } from "../interfaces/adapters.js";
import { MultiplexerHub } from "../core/multiplexer-hub.js";
import { AsyncEventQueue } from "../core/event-queue.js";
import { PersistenceProcessor } from "../processors/persistence-processor.js";
import { LoggerProcessor } from "../processors/logger-processor.js";
import { ClockProcessor } from "../processors/clock-processor.js";
import { InputProcessor } from "../processors/input-processor.js";
import { SessionProcessor } from "../processors/session-processor.js";
import {
  createPlanningProcessor,
  createTaskingProcessor,
  createDevelopmentProcessor,
  createQualityProcessor,
  createAgentProcessor,
  createToolProcessor,
  createTelemetryProcessor,
} from "../processors/stub-processors.js";
import type { EventProcessor } from "../interfaces/event-processor.js";

const LEDGER_FILENAME = "ledger.jsonl";
const CONFIG_FILENAME = "ductus.config.json";

export interface BootstrapperOptions {
  cwd: string;
  /** For testing: override processors (e.g. mock LoggerProcessor). */
  processorOverrides?: {
    logger?: EventProcessor;
    input?: EventProcessor;
    session?: EventProcessor;
  };
  /** For testing: override adapters to avoid loading execa etc. */
  adapterOverrides?: {
    file?: FileAdapter;
    os?: OSAdapter;
    terminal?: TerminalAdapter;
  };
}

export class Bootstrapper {
  private readonly hub = new MultiplexerHub();
  private readonly fileAdapter: FileAdapter;
  private readonly osAdapter: OSAdapter;
  private readonly terminalAdapter: TerminalAdapter;

  constructor(private readonly options: BootstrapperOptions) {
    const overrides = options.adapterOverrides;
    if (overrides?.file && overrides?.os && overrides?.terminal) {
      this.fileAdapter = overrides.file;
      this.osAdapter = overrides.os;
      this.terminalAdapter = overrides.terminal;
    } else {
      const { NodeFsAdapter } = require("../adapters/node-fs-adapter.js");
      const { NodeOSAdapter } = require("../adapters/node-os-adapter.js");
      const { CliTerminalAdapter } = require("../adapters/cli-terminal-adapter.js");
      this.fileAdapter = new NodeFsAdapter();
      this.osAdapter = new NodeOSAdapter();
      this.terminalAdapter = new CliTerminalAdapter();
    }
  }

  async ignite(): Promise<void> {
    this.wireProcessors();

    const ledgerPath = join(this.options.cwd, LEDGER_FILENAME);
    const ledgerExists = await this.fileAdapter.exists(ledgerPath);

    if (!ledgerExists) {
      this.hub.mode = "LiveMode";
      await this.hub.broadcast({
        type: "SYSTEM_START",
        payload: {},
        authorId: "bootstrapper",
        timestamp: Date.now(),
        volatility: "durable-draft",
      });
      return;
    }

    this.hub.mode = "SilentMode";
    await this.hydrateLedger(ledgerPath);
    this.hub.mode = "LiveMode";

    await this.hub.broadcast({
      type: "SYSTEM_START",
      payload: {},
      authorId: "bootstrapper",
      timestamp: Date.now(),
      volatility: "durable-draft",
    });
  }

  private wireProcessors(): void {
    const persistenceQueue = new AsyncEventQueue();
    const loggerQueue = new AsyncEventQueue();
    const clockQueue = new AsyncEventQueue();
    const inputQueue = new AsyncEventQueue();
    const sessionQueue = new AsyncEventQueue();

    const configPath = join(this.options.cwd, CONFIG_FILENAME);
    const ledgerPath = join(this.options.cwd, LEDGER_FILENAME);

    const persistence = new PersistenceProcessor(
      this.fileAdapter,
      ledgerPath,
      persistenceQueue
    );
    const logger =
      this.options.processorOverrides?.logger ??
      new LoggerProcessor(this.terminalAdapter, loggerQueue);
    const clock = new ClockProcessor(this.hub, clockQueue);
    const input =
      this.options.processorOverrides?.input ??
      new InputProcessor(this.hub, this.terminalAdapter, inputQueue);
    const session =
      this.options.processorOverrides?.session ??
      new SessionProcessor(
        this.hub,
        this.fileAdapter,
        configPath,
        ledgerPath,
        sessionQueue
      );

    this.hub.register(persistence);
    this.hub.register(logger);
    this.hub.register(clock);
    this.hub.register(input);
    this.hub.register(session);
    this.hub.register(createPlanningProcessor());
    this.hub.register(createTaskingProcessor());
    this.hub.register(createDevelopmentProcessor());
    this.hub.register(createQualityProcessor());
    this.hub.register(createAgentProcessor());
    this.hub.register(createToolProcessor());
    this.hub.register(createTelemetryProcessor());
  }

  private async hydrateLedger(ledgerPath: string): Promise<void> {
    for await (const line of this.fileAdapter.readStream(ledgerPath)) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as CommitedEvent;
        this.hub.injectReplay(event);
      } catch {
        this.terminalAdapter.log(
          "[FATAL] Ledger file corrupted. Cannot parse JSON. Aborting."
        );
        process.exit(1);
      }
    }
  }
}
