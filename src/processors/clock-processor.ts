/**
 * ClockProcessor - The Suprachiasmatic Nucleus.
 * Single source of logical time. Injects TICK events into the Hub.
 * RFC-001 Task 007-clock-processor, Impl Guide Phase 2.
 */

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import { createTick } from "../core/events/creators.js";

const TICK_INTERVAL_MS = 1000;
const AUTHOR_ID = "clock-processor";

export class ClockProcessor implements EventProcessor {
  constructor() { }

  async *process(stream: InputEventStream): OutputEventStream {
    const iterator = stream[Symbol.asyncIterator]();
    let nextStreamEvent = iterator.next();

    let timerResolve: (() => void) | null = null;
    let nextTimerPromise: Promise<void> = new Promise<void>(() => { });

    const resetTimer = () => {
      nextTimerPromise = new Promise<void>((resolve) => {
        timerResolve = resolve;
      });
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (intervalId) clearInterval(intervalId);
      resetTimer();
      intervalId = setInterval(() => {
        if (timerResolve) timerResolve();
        resetTimer();
      }, TICK_INTERVAL_MS);
    };

    const stopInterval = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    };

    try {
      while (true) {
        const promises: Promise<any>[] = [nextStreamEvent];
        if (intervalId) {
          promises.push(nextTimerPromise.then(() => "TICK_FIRED"));
        }

        const winner = await Promise.race(promises);

        if (winner === "TICK_FIRED") {
          yield createTick({
            payload: { ms: TICK_INTERVAL_MS, isReplay: false },
            authorId: AUTHOR_ID,
            timestamp: Date.now()
          });
        } else {
          const result = winner as IteratorResult<BaseEvent>;
          if (result.done) break;
          const event = result.value;

          nextStreamEvent = iterator.next();

          if (event.type === "SYSTEM_START" && !(event as any).isReplay) {
            startInterval();
          } else if (event.type === "SYSTEM_HALT" || event.type === "CIRCUIT_INTERRUPTED") {
            stopInterval();
          }

          const isReplay = (event as any).isReplay === true;
          if (isReplay && event.type !== "TICK") {
            yield createTick({
              payload: { ms: TICK_INTERVAL_MS, isReplay },
              authorId: AUTHOR_ID,
              timestamp: event.timestamp
            });
          }
        }
      }
    } finally {
      stopInterval();
    }
  }
}
