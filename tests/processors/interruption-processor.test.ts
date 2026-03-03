/**
 * InterruptionProcessor Definition of Done.
 * Task 009-interruption-processor.
 */

import { InterruptionProcessor } from "../../research/processors/interruption-processor.js";
import { AsyncEventQueue } from "../../research/core/event-queue.js";
import type { BaseEvent } from "../../research/interfaces/event.js";

describe("InterruptionProcessor", () => {
  let processor: InterruptionProcessor;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    processExitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    processor?.detach();
    processExitSpy.mockRestore();
  });

  describe("The Double Tap Proof", () => {
    it("first handleSigint yields CIRCUIT_INTERRUPTED; second triggers process.exit(1) instantly", async () => {
      processor = new InterruptionProcessor();
      const q = new AsyncEventQueue();
      const outStream = processor.process(q);

      processor.handleSignal("SIGINT");

      const iter = outStream[Symbol.asyncIterator]();
      const result = await iter.next();

      expect(result.value).toEqual(
        expect.objectContaining({
          type: "CIRCUIT_INTERRUPTED",
          payload: { signal: "SIGINT" },
          volatility: "durable-draft",
        })
      );
      expect(processExitSpy).not.toHaveBeenCalled();

      processor.handleSignal("SIGINT");

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("The Grace Period Proof", () => {
    it("first handleSigint schedules 1000ms fallback timeout", () => {
      jest.useFakeTimers();
      const setTimeoutSpy = jest.spyOn(global, "setTimeout");

      processor = new InterruptionProcessor();

      processor.handleSignal("SIGINT");

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      setTimeoutSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
