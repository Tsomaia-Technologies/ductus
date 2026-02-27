/**
 * SessionProcessor - The Librarian.
 * Context genesis: loads ductus.config, detects Genesis vs Continuation, yields CONTEXT_LOADED.
 * RFC-001 Task 012-session-processor, Rev 06 Section 2.1.
 */

import type { BaseEvent } from "../interfaces/event.js";
import { DuctusConfigSchema, type DuctusConfig } from "../core/ductus-config-schema.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import type { FileAdapter } from "../interfaces/adapters.js";
import { RingBufferQueue } from "../core/event-queue.js";
import { createSystemAbortRequested, createContextLoaded } from "../core/events/creators.js";

type EnqueuedEvent = {
  type: string;
  payload: unknown;
  authorId: string;
  timestamp: number;
  isReplay?: boolean;
};

const AUTHOR_ID = "session-processor";

/** Hardcoded defaults when config file does not exist. */
const DEFAULT_CONFIG: DuctusConfig = {
  default: {
    checks: {},
    roles: {
      planner: {
        lifecycle: "single-shot",
        maxRejections: 3,
        maxRecognizedHallucinations: 0,
        strategies: [{ id: "default", model: "claude-3-5-sonnet", template: "planner" }],
      },
      engineer: {
        lifecycle: "session",
        maxRejections: 5,
        maxRecognizedHallucinations: 2,
        strategies: [{ id: "default", model: "claude-3-5-sonnet", template: "engineer" }],
      },
    },
  },
  scopes: {},
};

function parseConfigRaw(raw: string): DuctusConfig | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Config JSON parse error: ${msg}` };
  }
  const result = DuctusConfigSchema.safeParse(parsed);
  if (result.success) return result.data;
  const zodErr = result.error;
  const issues = zodErr.issues;
  const first = issues[0];
  const path = first ? first.path.join(".") : "config";
  const detail = first ? first.message : zodErr.message;
  return { error: `Config validation failed at "${path}": ${detail}` };
}

export class SessionProcessor implements EventProcessor {
  private readonly outQueue = new RingBufferQueue<BaseEvent>(16);

  constructor(
    private readonly fileAdapter: FileAdapter,
    private readonly configPath: string,
    private readonly ledgerPath: string
  ) { }

  async *process(stream: InputEventStream): OutputEventStream {
    this.consumeAndLoad(stream).catch(console.error);
    for await (const out of this.outQueue) {
      yield out;
    }
  }

  private async consumeAndLoad(
    stream: AsyncIterable<EnqueuedEvent>
  ): Promise<void> {
    for await (const event of stream) {
      if (event.type !== "SYSTEM_START") continue;
      if (event.isReplay) continue;

      const configExists = await this.fileAdapter.exists(this.configPath);
      const ledgerExists = await this.fileAdapter.exists(this.ledgerPath);
      const isGenesis = !ledgerExists;

      let config: DuctusConfig;
      if (configExists) {
        const raw = await this.fileAdapter.read(this.configPath);
        const parsed = parseConfigRaw(raw);
        if ("error" in parsed) {
          this.outQueue.push(createSystemAbortRequested({
            payload: { reason: parsed.error },
            authorId: AUTHOR_ID,
            timestamp: Date.now()
          }));
          continue;
        }
        config = parsed;
      } else {
        config = DEFAULT_CONFIG;
      }

      this.outQueue.push(createContextLoaded({
        payload: { config, isGenesis },
        authorId: AUTHOR_ID,
        timestamp: Date.now()
      }));
    }

    this.outQueue.close();
  }
}
