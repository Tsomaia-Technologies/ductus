/**
 * State Machine Reducer Definition of Done.
 * Task 006-state-machine-reducer.
 */

import {
  ductusReducer,
  GENESIS_STATE,
  type StateMachineContext,
} from "../../src/core/state-machine-reducer.js";
import type { CommitedEvent } from "../../src/core/event-contracts.js";

const VALID_SHA256 =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function mockEvent(
  type: string,
  payload: unknown = {},
  authorId = "agent-1"
): CommitedEvent {
  return {
    eventId: VALID_UUID,
    type,
    payload,
    authorId,
    timestamp: 1000,
    sequenceNumber: 1,
    prevHash: VALID_SHA256,
    hash: VALID_SHA256,
    volatility: "durable",
  };
}

describe("ductusReducer", () => {
  describe("The Pure Clone Proof", () => {
    it("returns a new state object; referential inequality proves clone", () => {
      const mockState: StateMachineContext = {
        ...GENESIS_STATE,
        status: "coding",
        hallucinations: 0,
      };

      const event = mockEvent("PLAN_APPROVED", { spec: "x" });
      const [newState] = ductusReducer(mockState, event);

      expect(newState).not.toBe(mockState);
    });
  });

  describe("The Hallucination Threshold Proof", () => {
    it("first AUTO_REJECTION: hallucinations=5, no KILL_AGENT; second: KILL_AGENT in effects", () => {
      const mockState: StateMachineContext = {
        ...GENESIS_STATE,
        hallucinations: 4,
        config: { maxRecognizedHallucinations: 5 },
      };

      const event = mockEvent("AUTO_REJECTION", { reason: "diff_mismatch" });

      const [stateAfterFirst, effectsFirst] = ductusReducer(mockState, event);

      expect(stateAfterFirst.hallucinations).toBe(5);
      expect(effectsFirst.some((e) => e.type === "KILL_AGENT")).toBe(false);

      const [stateAfterSecond, effectsSecond] = ductusReducer(
        stateAfterFirst,
        event
      );

      expect(stateAfterSecond.hallucinations).toBe(6);
      expect(effectsSecond.some((e) => e.type === "KILL_AGENT")).toBe(true);
      expect(effectsSecond.some((e) => e.type === "HALLUCINATION_DETECTED")).toBe(
        true
      );
    });
  });
});
