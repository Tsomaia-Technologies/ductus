/**
 * InterruptionProcessor Definition of Done.
 * Task 009-interruption-processor.
 */

import { InterruptionProcessor } from "../../src/processors/interruption-processor.js";

describe("InterruptionProcessor", () => {
  let mockHub: { broadcast: jest.Mock };
  let processor: InterruptionProcessor;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    mockHub = { broadcast: jest.fn().mockResolvedValue(undefined) };
    processExitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    processor?.detach();
    processExitSpy.mockRestore();
  });

  describe("The Double Tap Proof", () => {
    it("first handleSigint yields CIRCUIT_INTERRUPTED; second triggers process.exit(1) instantly", () => {
      processor = new InterruptionProcessor(mockHub);

      processor.handleSignal("SIGINT");

      expect(mockHub.broadcast).toHaveBeenCalledTimes(1);
      expect(mockHub.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "CIRCUIT_INTERRUPTED",
          payload: { signal: "SIGINT" },
          volatility: "durable-draft",
        })
      );
      expect(processExitSpy).not.toHaveBeenCalled();

      processor.handleSignal("SIGINT");

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockHub.broadcast).toHaveBeenCalledTimes(1);
    });
  });

  describe("The Grace Period Proof", () => {
    it("first handleSigint schedules 1000ms fallback timeout", () => {
      jest.useFakeTimers();
      const setTimeoutSpy = jest.spyOn(global, "setTimeout");

      processor = new InterruptionProcessor(mockHub);

      processor.handleSignal("SIGINT");

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      setTimeoutSpy.mockRestore();
      jest.useRealTimers();
    });
  });
});
