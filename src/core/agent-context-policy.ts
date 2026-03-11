import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { AgentLifecycleState } from '../interfaces/agent-lifecycle.js'
import { ContextPolicy, ContextPolicyContext } from '../interfaces/context-policy.js'
import { CommittedEvent } from '../interfaces/event.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { TemplateRenderer } from '../interfaces/template-renderer.js'
import { ReplaceContextPolicy } from './context-policies/replace-context-policy.js'
import { TruncateContextPolicy } from './context-policies/truncate-context-policy.js'
import { SummarizeContextPolicy } from './context-policies/summarize-context-policy.js'
import { SlidingWindowContextPolicy } from './context-policies/sliding-window-context-policy.js'

export interface ContextPolicyDeps {
  ledger?: EventLedger
  getState: () => unknown
  templateRenderer: TemplateRenderer
}

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

async function* emptyAsyncIterable(): AsyncIterable<CommittedEvent> {
  // yields nothing
}

export async function enforceContextPolicy(
  agentConfig: AgentEntity,
  state: AgentLifecycleState,
  model?: string,
  deps?: ContextPolicyDeps,
): Promise<void> {
  if (agentConfig.maxContextTokens === undefined) return
  if (state.conversation.tokenEstimate < agentConfig.maxContextTokens) return

  const policy = resolveContextPolicy(agentConfig)

  let context: ContextPolicyContext | undefined
  if (deps) {
    context = {
      events: deps.ledger ? deps.ledger.readEvents() : emptyAsyncIterable(),
      state: deps.getState(),
      templateRenderer: deps.templateRenderer,
    }
  }

  state.conversation = await policy.apply(
    state.conversation,
    agentConfig.maxContextTokens,
    state.transport,
    model,
    context,
  )
}
