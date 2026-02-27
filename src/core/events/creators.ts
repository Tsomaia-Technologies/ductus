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
export const createRequestTool = createEvent("REQUEST_TOOL", "durable-draft");
export const createToolOutput = createEvent("TOOL_OUTPUT", "durable-draft");
export const createToolFailure = createEvent("TOOL_FAILURE", "durable-draft");

// High-frequency UI events MUST be volatile
export const createToolStdoutChunk = createEvent("TOOL_STDOUT_CHUNK", "volatile-draft");
export const createAgentToken = createEvent("AGENT_TOKEN", "volatile-draft");
