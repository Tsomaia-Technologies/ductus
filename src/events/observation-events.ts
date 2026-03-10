import { signal } from '../utils/event-utils.js'
import { string, number, boolean, object } from '../utils/schema-utils.js'

export const AgentInvoked = signal('Ductus/AgentInvoked', {
  agent: string(),
  skill: string(),
  inputHash: string(),
})

export const AgentCompleted = signal('Ductus/AgentCompleted', {
  agent: string(),
  skill: string(),
  durationMs: number(),
  tokenUsage: object({ input: number(), output: number(), total: number() }),
})

export const AgentFailed = signal('Ductus/AgentFailed', {
  agent: string(),
  skill: string(),
  error: string(),
})

export const AgentReplaced = signal('Ductus/AgentReplaced', {
  agent: string(),
  reason: string(),
  newAgent: string(),
})

export const AgentStreamChunk = signal('Ductus/AgentStreamChunk', {
  agent: string(),
  skill: string(),
  chunk: object({ type: string(), content: string() }),
})

export const SkillInvoked = signal('Ductus/SkillInvoked', {
  agent: string(),
  skill: string(),
  inputHash: string(),
})

export const SkillCompleted = signal('Ductus/SkillCompleted', {
  agent: string(),
  skill: string(),
  durationMs: number(),
})

export const SkillFailed = signal('Ductus/SkillFailed', {
  agent: string(),
  skill: string(),
  error: string(),
  retriesExhausted: boolean(),
})

export const SkillRetry = signal('Ductus/SkillRetry', {
  agent: string(),
  skill: string(),
  attempt: number(),
  maxRetries: number(),
  error: string(),
})

export const ToolRequested = signal('Ductus/ToolRequested', {
  agent: string(),
  tool: string(),
  arguments: string(),
})

export const ToolCompleted = signal('Ductus/ToolCompleted', {
  agent: string(),
  tool: string(),
  durationMs: number(),
  resultSummary: string(),
})

export const observationEvents = {
  AgentInvoked,
  AgentCompleted,
  AgentFailed,
  AgentReplaced,
  AgentStreamChunk,
  SkillInvoked,
  SkillCompleted,
  SkillFailed,
  SkillRetry,
  ToolRequested,
  ToolCompleted,
}
