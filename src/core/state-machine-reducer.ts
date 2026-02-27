/**
 * Pure State Machine Reducer - The Memory & Limbic System.
 * (State, Event) -> [NewState, PendingEffects]. Zero I/O.
 * Enforces Zero-Trust constraints (e.g. Hallucination limit quarantine).
 */

import type { CommittedEvent, BaseEvent } from "../interfaces/event.js";
import { createAgentFailure } from "./events/creators.js";

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
    BaseEvent[] // Effects strictly yielded to the loop
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
    event: CommittedEvent<string, unknown>
): StateReducerResult {
    switch (event.type) {
        case "AGENT_FAILURE":
            return handleAgentFailure(state, event);
        case "SPEC_APPROVED":
            return [{ ...state, status: "tasking" }, []];
        case "TASKS_APPROVED":
            return [{ ...state, status: "coding" }, []];
        case "FEATURE_READY":
            return [{ ...state, status: "verifying" }, []];
        case "FEATURE_APPROVED":
            return [{ ...state, status: "completed" }, []];
        case "EMERGENCY_STOP":
        case "CIRCUIT_INTERRUPTED":
            return handlePanic(state, event);
        default:
            return [state, []];
    }
}

function handleAgentFailure(
    state: StateMachineContext,
    event: CommittedEvent<string, unknown>
): StateReducerResult {
    const payload = event.payload as { reason: string };
    if (payload?.reason !== "hallucination") {
        return [state, []];
    }

    const next = { ...state, hallucinations: state.hallucinations + 1 };

    if (next.hallucinations > state.config.maxRecognizedHallucinations) {
        const effects: BaseEvent[] = [
            createAgentFailure({
                payload: { reason: "hallucination" },
                authorId: "state-machine",
                timestamp: event.timestamp
            })
        ];
        // Next state transitions to "failed" when max hallucinations are reached?
        // Or we let the engine handle the state transition based on the yielded failure.
        // For now, we will return the updated hallucination count and the yielded failure.
        return [next, effects];
    }
    return [next, []];
}

function handlePanic(
    state: StateMachineContext,
    event: CommittedEvent<string, unknown>
): StateReducerResult {
    return [{ ...state, status: "failed", tasks: [] }, []];
}
