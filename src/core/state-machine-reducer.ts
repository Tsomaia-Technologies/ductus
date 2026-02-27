/**
 * Pure State Machine Reducer - The Memory & Limbic System.
 * (State, Event) -> [NewState, PendingEffects]. Zero I/O. Replaces XState.
 * RFC-001 Task 006-state-machine-reducer, Impl Guide A.3.
 */

import type { BaseEvent, CommitedEvent } from "./event-contracts.js";

export type StateStatus =
  | "negotiating"
  | "planning"
  | "tasking"
  | "coding"
  | "verifying"
  | "completed"
  | "failed";

export interface StateMachineConfig {
  maxRecognizedHallucinations: number;
}

export interface StateMachineContext {
  status: StateStatus;
  hallucinations: number;
  rejections: number;
  tasks: string[];
  config: StateMachineConfig;
}

export type StateReducerResult = [
  StateMachineContext,
  BaseEvent<string, unknown>[],
];

/** Genesis state tree. Bootstrapper uses this as initial state. */
export const GENESIS_STATE: StateMachineContext = {
  status: "negotiating",
  hallucinations: 0,
  rejections: 0,
  tasks: [],
  config: { maxRecognizedHallucinations: 5 },
};

/**
 * Pure reducer: (State, Event) -> [NewState, Effects].
 * Never mutates state. Deterministic: same inputs => same outputs.
 */
export function ductusReducer(
  state: StateMachineContext,
  event: CommitedEvent<string, unknown>
): StateReducerResult {
  switch (event.type) {
    case "AUTO_REJECTION":
      return handleAutoRejection(state, event);
    case "EMERGENCY_STOP":
    case "CIRCUIT_INTERRUPTED":
      return handlePanic(state, event);
    default:
      return [shallowClone(state), []];
  }
}

function shallowClone(s: StateMachineContext): StateMachineContext {
  return {
    status: s.status,
    hallucinations: s.hallucinations,
    rejections: s.rejections,
    tasks: [...s.tasks],
    config: { ...s.config },
  };
}

function handleAutoRejection(
  state: StateMachineContext,
  event: CommitedEvent<string, unknown>
): StateReducerResult {
  const newHallucinations = state.hallucinations + 1;
  const next = shallowClone(state);
  next.hallucinations = newHallucinations;

  const max = state.config.maxRecognizedHallucinations;
  if (newHallucinations > max) {
    const effects: BaseEvent<string, unknown>[] = [
      {
        type: "KILL_AGENT",
        payload: {},
        authorId: "state-machine",
        timestamp: event.timestamp,
        volatility: "durable-draft",
      },
      {
        type: "HALLUCINATION_DETECTED",
        payload: { authorId: event.authorId },
        authorId: "state-machine",
        timestamp: event.timestamp,
        volatility: "durable-draft",
      },
    ];
    return [next, effects];
  }
  return [next, []];
}

function handlePanic(
  state: StateMachineContext,
  event: CommitedEvent<string, unknown>
): StateReducerResult {
  const next = shallowClone(state);
  next.status = "failed";
  next.tasks = [];
  return [next, []];
}
