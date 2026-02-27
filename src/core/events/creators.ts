import type { ProcessableEvent, EventTypePayloadMap } from "./types.js";

type EventFactory<T extends ProcessableEvent["type"]> = (args: {
    payload: EventTypePayloadMap[T];
    authorId: string;
    timestamp?: number;
}) => ProcessableEvent & { type: T };

function createEvent<T extends ProcessableEvent["type"]>(
    type: T,
    volatility: ProcessableEvent["volatility"]
): EventFactory<T> {
    return ({ payload, authorId, timestamp = Date.now() }) =>
    ({
        type,
        payload,
        authorId,
        timestamp,
        volatility,
    } as ProcessableEvent & { type: T });
}

// --- Lifecycle (Durable) ---
export const createSystemStart = createEvent("SYSTEM_START", "durable-draft");
export const createContextLoaded = createEvent("CONTEXT_LOADED", "durable-draft");

// --- Heartbeat (Volatile/Durable mix based on replay needs, typically volatile unless tracing) ---
export const createTick = createEvent("TICK", "volatile-draft");
export const createCircuitInterrupted = createEvent("CIRCUIT_INTERRUPTED", "durable-draft");

// --- Planning & State (Durable) ---
export const createRequestPlanning = createEvent("REQUEST_PLANNING", "durable-draft");
export const createSpecApproved = createEvent("SPEC_APPROVED", "durable-draft");
export const createRequestTaskBreakdown = createEvent("REQUEST_TASK_BREAKDOWN", "durable-draft");
export const createTasksApproved = createEvent("TASKS_APPROVED", "durable-draft");
export const createRequestImplementation = createEvent("REQUEST_IMPLEMENTATION", "durable-draft");
export const createFeatureReady = createEvent("FEATURE_READY", "durable-draft");
export const createRequestAudit = createEvent("REQUEST_AUDIT", "durable-draft");
export const createFeatureApproved = createEvent("FEATURE_APPROVED", "durable-draft");
export const createTaskCompleted = createEvent("TASK_COMPLETED", "durable-draft");

// --- Agents (Durable) ---
export const createAgentResponse = createEvent("AGENT_RESPONSE", "durable-draft");
export const createAgentFailure = createEvent("AGENT_FAILURE", "durable-draft");

// --- Tools (Durable/Volatile mix) ---
export const createEffectRunTool = createEvent("EFFECT_RUN_TOOL", "durable-draft");
export const createToolCompleted = createEvent("TOOL_COMPLETED", "durable-draft");
export const createToolFailed = createEvent("TOOL_FAILED", "durable-draft");

// High-frequency UI events MUST be volatile
export const createToolStdoutChunk = createEvent("TOOL_STDOUT_CHUNK", "volatile-draft");
export const createAgentToken = createEvent("AGENT_TOKEN", "volatile-draft");
export const createInputReceived = createEvent("INPUT_RECEIVED", "durable-draft");

export const createEffectSpawnAgent = createEvent("EFFECT_SPAWN_AGENT", "durable-draft");
export const createRequestInput = createEvent("REQUEST_INPUT", "durable-draft");
export const createPlanApproved = createEvent("PLAN_APPROVED", "durable-draft");
export const createPlanRejected = createEvent("PLAN_REJECTED", "durable-draft");
export const createSystemAbortRequested = createEvent("SYSTEM_ABORT_REQUESTED", "durable-draft");

export const createTelemetryUpdated = createEvent("TELEMETRY_UPDATED", "volatile-draft");

export const createFeatureRejected = createEvent("FEATURE_REJECTED", "durable-draft");

// --- State Machine Internals (Durable) ---
export const createAutoRejection = createEvent("AUTO_REJECTION", "durable-draft");
export const createKillAgent = createEvent("KILL_AGENT", "durable-draft");
export const createHallucinationDetected = createEvent("HALLUCINATION_DETECTED", "durable-draft");
