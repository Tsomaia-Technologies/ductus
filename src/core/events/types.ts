import type { BaseEvent } from "../../interfaces/event.js";

// --- System & Lifecycle Events ---

export interface SystemStartEvent extends BaseEvent<"SYSTEM_START", { mode: "new" | "resume" }> { }

export interface ContextLoadedEvent
    extends BaseEvent<"CONTEXT_LOADED", { activeSessions: number; filesScanned: number }> { }

export interface TickEvent extends BaseEvent<"TICK", { ms: number; isReplay: boolean }> { }

export interface CircuitInterruptedEvent extends BaseEvent<"CIRCUIT_INTERRUPTED", { signal: string }> { }

// --- Agent & Engine Execution Events ---

export interface RequestPlanningEvent extends BaseEvent<"REQUEST_PLANNING", { rawPrompt: string }> { }

export interface SpecApprovedEvent
    extends BaseEvent<"SPEC_APPROVED", { specPath: string; hash: string }> { }

export interface RequestTaskBreakdownEvent
    extends BaseEvent<"REQUEST_TASK_BREAKDOWN", { specHash: string }> { }

export interface TasksApprovedEvent extends BaseEvent<"TASKS_APPROVED", { count: number }> { }

export interface RequestImplementationEvent
    extends BaseEvent<"REQUEST_IMPLEMENTATION", { taskId: string }> { }

export interface FeatureReadyEvent extends BaseEvent<"FEATURE_READY", {}> { }

export interface RequestAuditEvent extends BaseEvent<"REQUEST_AUDIT", {}> { }

export interface FeatureApprovedEvent extends BaseEvent<"FEATURE_APPROVED", {}> { }

export interface TaskCompletedEvent extends BaseEvent<"TASK_COMPLETED", { taskId: string }> { }

// --- Sub-Systems (Agent/Tools/UI) ---

export interface AgentResponseEvent
    extends BaseEvent<"AGENT_RESPONSE", { text: string; filesModified: string[] }> { }

export interface AgentFailureEvent
    extends BaseEvent<"AGENT_FAILURE", { reason: "hallucination" | "timeout" | "format" }> { }

export interface RequestToolEvent extends BaseEvent<"REQUEST_TOOL", { command: string; args: string[] }> { }

export interface ToolOutputEvent
    extends BaseEvent<"TOOL_OUTPUT", { stdout: string; stderr: string; exitCode: number }> { }

export interface ToolFailureEvent extends BaseEvent<"TOOL_FAILURE", { error: string }> { }

export interface ToolStdoutChunkEvent extends BaseEvent<"TOOL_STDOUT_CHUNK", { chunk: string }> { }

export interface AgentTokenEvent extends BaseEvent<"AGENT_TOKEN", { token: string }> { }

// --- Type Registry ---

export type ProcessableEvent =
    | SystemStartEvent
    | ContextLoadedEvent
    | TickEvent
    | CircuitInterruptedEvent
    | RequestPlanningEvent
    | SpecApprovedEvent
    | RequestTaskBreakdownEvent
    | TasksApprovedEvent
    | RequestImplementationEvent
    | FeatureReadyEvent
    | RequestAuditEvent
    | FeatureApprovedEvent
    | TaskCompletedEvent
    | AgentResponseEvent
    | AgentFailureEvent
    | RequestToolEvent
    | ToolOutputEvent
    | ToolFailureEvent
    | ToolStdoutChunkEvent
    | AgentTokenEvent;

export interface EventTypePayloadMap {
    SYSTEM_START: SystemStartEvent["payload"];
    CONTEXT_LOADED: ContextLoadedEvent["payload"];
    TICK: TickEvent["payload"];
    CIRCUIT_INTERRUPTED: CircuitInterruptedEvent["payload"];
    REQUEST_PLANNING: RequestPlanningEvent["payload"];
    SPEC_APPROVED: SpecApprovedEvent["payload"];
    REQUEST_TASK_BREAKDOWN: RequestTaskBreakdownEvent["payload"];
    TASKS_APPROVED: TasksApprovedEvent["payload"];
    REQUEST_IMPLEMENTATION: RequestImplementationEvent["payload"];
    FEATURE_READY: FeatureReadyEvent["payload"];
    REQUEST_AUDIT: RequestAuditEvent["payload"];
    FEATURE_APPROVED: FeatureApprovedEvent["payload"];
    TASK_COMPLETED: TaskCompletedEvent["payload"];
    AGENT_RESPONSE: AgentResponseEvent["payload"];
    AGENT_FAILURE: AgentFailureEvent["payload"];
    REQUEST_TOOL: RequestToolEvent["payload"];
    TOOL_OUTPUT: ToolOutputEvent["payload"];
    TOOL_FAILURE: ToolFailureEvent["payload"];
    TOOL_STDOUT_CHUNK: ToolStdoutChunkEvent["payload"];
    AGENT_TOKEN: AgentTokenEvent["payload"];
}
