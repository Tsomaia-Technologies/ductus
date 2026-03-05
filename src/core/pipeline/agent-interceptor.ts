import { AgentChunk } from '../../interfaces/agent-chunk.js'
import { AgentLifecycleState, AgentTuple } from '../../interfaces/agent-lifecycle.js'
import { SkillEntity } from '../../interfaces/entities/skill-entity.js'

export interface InvocationContext {
  agentName: string
  skillName: string
  input: unknown

  agentTuple?: AgentTuple
  skill?: SkillEntity
  prompt?: string

  // Pipeline-managed states
  state?: AgentLifecycleState
  data: Map<string, any>
}

export type InterceptorNext = (context: InvocationContext) => AsyncGenerator<AgentChunk, void, unknown>

export interface AgentInterceptor {
  intercept(context: InvocationContext, next: InterceptorNext): AsyncGenerator<AgentChunk, void, unknown>
}
