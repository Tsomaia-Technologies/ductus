import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { AgentLifecycleState } from '../interfaces/agent-lifecycle.js'
import { ContextPolicy } from '../interfaces/context-policy.js'
import { ReplaceContextPolicy } from './context-policies/replace-context-policy.js'
import { TruncateContextPolicy } from './context-policies/truncate-context-policy.js'
import { SummarizeContextPolicy } from './context-policies/summarize-context-policy.js'
import { SlidingWindowContextPolicy } from './context-policies/sliding-window-context-policy.js'

export function resolveContextPolicy(agentConfig: AgentEntity): ContextPolicy {
  const { contextPolicy } = agentConfig
  if (!contextPolicy || typeof contextPolicy === 'string') {
    switch (contextPolicy) {
      case 'replace': return new ReplaceContextPolicy()
      case 'truncate': return new TruncateContextPolicy()
      case 'summarize': return new SummarizeContextPolicy()
      case 'sliding-window': return new SlidingWindowContextPolicy({ windowTokens: agentConfig.maxContextTokens ?? Infinity })
      default: return new TruncateContextPolicy()
    }
  }
  return contextPolicy
}

export async function enforceContextPolicy(
  agentConfig: AgentEntity,
  state: AgentLifecycleState,
  model?: string,
): Promise<void> {
  if (agentConfig.maxContextTokens === undefined) return
  if (state.conversation.tokenEstimate < agentConfig.maxContextTokens) return

  const policy = resolveContextPolicy(agentConfig)
  state.conversation = await policy.apply(
    state.conversation,
    agentConfig.maxContextTokens,
    state.transport,
    model,
  )
}
