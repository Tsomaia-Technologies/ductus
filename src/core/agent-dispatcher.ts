import { BaseEvent } from '../interfaces/event.js'
import { Injector } from '../interfaces/event-generator.js'
import { StoreAdapter } from '../interfaces/store-adapter.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { AgentTuple } from '../interfaces/agent-lifecycle.js'
import { invokeAgent, AssertionExhaustedError } from './agent-invocation.js'
import { AgentPromptComposer } from './agent-prompt-composer.js'
import { AgentLifecycleManager } from './agent-lifecycle-manager.js'
import { enforceContextPolicy } from './agent-context-policy.js'

import type { TemplateRenderer } from './agent-prompt-composer.js'
export type { TemplateRenderer } from './agent-prompt-composer.js'

export interface AgentDispatcherOptions<TState> {
  agents: AgentTuple[]
  store: StoreAdapter<TState>
  templateRenderer: TemplateRenderer
  systemAdapter: SystemAdapter
  fileAdapter: FileAdapter
  injector: Injector
}

export class AgentDispatcher<TState> {
  private readonly agents: Map<string, AgentTuple> = new Map()
  private readonly lifecycleManager: AgentLifecycleManager
  private readonly store: StoreAdapter<TState>
  private readonly injector: Injector
  private lastKnownSequence = 0

  constructor(options: AgentDispatcherOptions<TState>) {
    for (const tuple of options.agents) {
      this.agents.set(tuple.agent.name, tuple)
    }
    this.store = options.store
    this.injector = options.injector

    const promptComposer = new AgentPromptComposer(
      options.templateRenderer,
      options.fileAdapter,
      options.systemAdapter,
      options.injector,
    )
    this.lifecycleManager = new AgentLifecycleManager(
      this.agents,
      promptComposer,
      () => this.store.getState(),
    )
  }

  async invokeAndParse(agentName: string, skillName: string, input: unknown): Promise<{
    output: unknown
    observationEvents: BaseEvent[]
  }> {
    const tuple = this.agents.get(agentName)
    if (!tuple) throw new Error(`Agent '${agentName}' not found.`)
    const skill = tuple.agent.skill.find(s => s.name === skillName)
    if (!skill) throw new Error(`Skill '${skillName}' not found on agent '${agentName}'.`)

    const state = await this.lifecycleManager.getOrCreate(agentName)
    await this.lifecycleManager.enforceLimits(agentName, state, tuple.agent)

    const model = tuple.model?.model ?? tuple.agent.defaultModel?.model
    await enforceContextPolicy(tuple.agent, state, model)

    state.turns++
    state.currentTurnStartSequence = this.lastKnownSequence + 1

    const observationEvents: BaseEvent[] = []

    try {
      const result = await invokeAgent({
        agent: tuple.agent,
        skill,
        input,
        conversation: state.conversation,
        transport: state.transport,
        model: tuple.model ?? tuple.agent.defaultModel,
        getState: () => this.store.getState(),
        use: this.injector,
        onEvent: (event) => observationEvents.push(event),
      })

      state.conversation = result.conversation
      state.tokensUsed += result.tokenUsage.input + result.tokenUsage.output
      state.hallucinations += result.assertionFailures

      state.turnRecords.push({
        turnNumber: state.turns,
        startSequence: state.currentTurnStartSequence,
        endSequence: this.lastKnownSequence,
        failed: false,
      })

      return { output: result.output, observationEvents }
    } catch (err) {
      state.failures++
      if (err instanceof AssertionExhaustedError) {
        state.hallucinations += err.assertionFailures
      }

      state.turnRecords.push({
        turnNumber: state.turns,
        startSequence: state.currentTurnStartSequence,
        endSequence: this.lastKnownSequence,
        failed: true,
      })

      throw err
    }
  }

  async terminateAll(): Promise<void> {
    await this.lifecycleManager.terminateAll()
  }
}
