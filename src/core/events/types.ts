import type { BaseEvent } from "../../interfaces/event.js";

// --- System & Lifecycle Events ---

export interface SystemStartEvent extends BaseEvent<"SYSTEM_START", { mode: "new" | "resume" }> { }

export interface ContextLoadedEvent
    extends BaseEvent<"CONTEXT_LOADED", { config: any; isGenesis: boolean }> { }

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

export interface ToolCompletedEvent extends BaseEvent<"TOOL_COMPLETED", { trackingId?: string; exitCode?: number; stdout?: string; stderr?: string; log?: string }> { }

export interface ToolFailedEvent extends BaseEvent<"TOOL_FAILED", { trackingId?: string; exitCode?: number; stdout?: string; stderr?: string; log?: string; reason?: string }> { }

export interface ToolStdoutChunkEvent extends BaseEvent<"TOOL_STDOUT_CHUNK", { chunk: string }> { }

export interface AgentTokenEvent extends BaseEvent<"AGENT_TOKEN", { token: string }> { }

export interface InputReceivedEvent extends BaseEvent<"INPUT_RECEIVED", { id: string; answer: string }> { }

// --- State Machine Events ---

export interface AutoRejectionEvent
    extends BaseEvent<"AUTO_REJECTION", { isHallucination: boolean; type?: string }> { }

export interface KillAgentEvent extends BaseEvent<"KILL_AGENT", {}> { }

export interface HallucinationDetectedEvent
    extends BaseEvent<"HALLUCINATION_DETECTED", { authorId: string }> { }

export interface EffectSpawnAgentEvent extends BaseEvent<"EFFECT_SPAWN_AGENT", { roleName: string; scope: string; input: string; context?: any; correlationId?: string }> { }
export interface RequestInputEvent extends BaseEvent<"REQUEST_INPUT", { id: string; question: string; expectedSchemaType: string }> { }
export interface PlanApprovedEvent extends BaseEvent<"PLAN_APPROVED", { spec: string }> { }
export interface PlanRejectedEvent extends BaseEvent<"PLAN_REJECTED", { spec: string; feedback: string }> { }
export interface SystemAbortRequestedEvent extends BaseEvent<"SYSTEM_ABORT_REQUESTED", { reason: string }> { }
export interface TelemetryUpdatedEvent extends BaseEvent<"TELEMETRY_UPDATED", { byModel: any; totalInputTokens: number; totalOutputTokens: number; sessionStartTimestamp: number | null }> { }
export interface EffectRunToolEvent extends BaseEvent<"EFFECT_RUN_TOOL", { command: string; args: string[]; cwd?: string; trackingId: string }> { }
export interface FeatureRejectedEvent extends BaseEvent<"FEATURE_REJECTED", { reason: string; stderr?: string; log?: string; critique?: string }> { }

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
    | ToolCompletedEvent
    | ToolFailedEvent
    | ToolStdoutChunkEvent
    | AgentTokenEvent
    | InputReceivedEvent
    | AutoRejectionEvent
    | KillAgentEvent
    | HallucinationDetectedEvent
    | EffectSpawnAgentEvent
    | RequestInputEvent
    | PlanApprovedEvent
    | PlanRejectedEvent
    | SystemAbortRequestedEvent
    | TelemetryUpdatedEvent
    | EffectRunToolEvent
    | FeatureRejectedEvent;

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
    TOOL_COMPLETED: ToolCompletedEvent["payload"];
    TOOL_FAILED: ToolFailedEvent["payload"];
    TOOL_STDOUT_CHUNK: ToolStdoutChunkEvent["payload"];
    AGENT_TOKEN: AgentTokenEvent["payload"];
    INPUT_RECEIVED: InputReceivedEvent["payload"];
    AUTO_REJECTION: AutoRejectionEvent["payload"];
    KILL_AGENT: KillAgentEvent["payload"];
    HALLUCINATION_DETECTED: HallucinationDetectedEvent["payload"];
    EFFECT_SPAWN_AGENT: EffectSpawnAgentEvent["payload"];
    REQUEST_INPUT: RequestInputEvent["payload"];
    PLAN_APPROVED: PlanApprovedEvent["payload"];
    PLAN_REJECTED: PlanRejectedEvent["payload"];
    SYSTEM_ABORT_REQUESTED: SystemAbortRequestedEvent["payload"];
    TELEMETRY_UPDATED: TelemetryUpdatedEvent["payload"];
    EFFECT_RUN_TOOL: EffectRunToolEvent["payload"];
    FEATURE_REJECTED: FeatureRejectedEvent["payload"];
}
