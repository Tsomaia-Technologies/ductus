/**
 * InterruptionProcessor - The Brainstem.
 * Emergency kill switch. Listens for SIGINT/SIGTERM, yields CIRCUIT_INTERRUPTED.
 * RFC-001 Task 009-interruption-processor, Rev 06 Section 6.2.
 */

import type { BaseEvent } from "../core/event-contracts.js";

interface InterruptionHub {
  broadcast(base: BaseEvent): Promise<void>;
}

const AUTHOR_ID = "interruption-processor";
const GRACE_PERIOD_MS = 1000;

export class InterruptionProcessor {
  private stopCount = 0;
  private graceTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly boundSigint = () => this.handleSignal("SIGINT");
  private readonly boundSigterm = () => this.handleSignal("SIGTERM");

  constructor(private readonly hub: InterruptionHub) {
    process.on("SIGINT", this.boundSigint);
    process.on("SIGTERM", this.boundSigterm);
  }

  /** Invokable for tests. Signal string, e.g. 'SIGINT' or 'SIGTERM'. */
  handleSignal(signal: string): void {
    this.stopCount += 1;

    if (this.stopCount === 1) {
      void this.hub.broadcast({
        type: "CIRCUIT_INTERRUPTED",
        payload: { signal },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "durable-draft",
      });

      this.graceTimeout = setTimeout(() => {
        this.graceTimeout = null;
        process.exit(1);
      }, GRACE_PERIOD_MS);
      return;
    }

    if (this.graceTimeout !== null) {
      clearTimeout(this.graceTimeout);
      this.graceTimeout = null;
    }
    process.exit(1);
  }

  detach(): void {
    process.removeListener("SIGINT", this.boundSigint);
    process.removeListener("SIGTERM", this.boundSigterm);
    if (this.graceTimeout !== null) {
      clearTimeout(this.graceTimeout);
      this.graceTimeout = null;
    }
  }
}
