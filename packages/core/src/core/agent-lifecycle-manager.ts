import { AgentLifecycleState, AgentTuple } from '../interfaces/agent-lifecycle.js'
import { AgentEntity, HandoffReason } from '../interfaces/entities/agent-entity.js'
import { AgentPromptComposer } from './agent-prompt-composer.js'
import { ConversationImpl } from './conversation.js'
import { renderHandoff, readAllEvents, HandoffDeps } from './agent-handoff.js'

export class AgentLifecycleManager {
  private readonly lifecycle: Map<string, AgentLifecycleState> = new Map()

  constructor(
    private readonly agents: Map<string, AgentTuple>,
    private readonly promptComposer: AgentPromptComposer,
    private readonly getState: () => unknown,
    private readonly handoffDeps?: HandoffDeps,
  ) {}

  async getOrCreate(agentName: string): Promise<AgentLifecycleState> {
    let state = this.lifecycle.get(agentName)
    if (!state) {
      const tuple = this.agents.get(agentName)!
      const systemMessage = await this.promptComposer.compose(tuple.agent, this.getState())

      const transport = tuple.transport ?? tuple.agent.defaultTransport
      if (!transport) {
        throw new Error(`Agent '${agentName}' has no transport configured. Set defaultTransport on the agent or provide transport in the flow registration.`)
      }

      const conversation = ConversationImpl.create(systemMessage)

      state = {
        tokensUsed: 0,
        failures: 0,
        hallucinations: 0,
        turns: 0,
        transport,
        conversation,
        turnRecords: [],
        currentTurnStartSequence: 0,
      }
      this.lifecycle.set(agentName, state)
    }
    return state
  }

  async enforceLimits(
    agentName: string,
    state: AgentLifecycleState,
    agentConfig: AgentEntity,
  ): Promise<void> {
    const maxFailures = agentConfig.maxFailures ?? Infinity
    const maxHallucinations = agentConfig.maxRecognizedHallucinations ?? Infinity

    let reason: HandoffReason | undefined

    if (state.failures >= maxFailures || state.hallucinations >= maxHallucinations) {
      reason = 'failure'
    } else if (agentConfig.scope) {
      const scope = agentConfig.scope
      if (scope.type === 'turn' || scope.type === 'task') {
        if (state.turns >= scope.amount) {
          reason = 'scope'
        }
      }
    }

    if (reason) {
      let systemMessage = await this.promptComposer.compose(agentConfig, this.getState())

      const handoffContent = await this.tryRenderHandoff(agentConfig, reason, state)
      if (handoffContent) {
        systemMessage = systemMessage + '\n\n' + handoffContent
      }

      state.conversation = ConversationImpl.create(systemMessage)
      state.failures = 0
      state.hallucinations = 0
      state.turns = 0
      state.turnRecords = []
    }
  }

  private async tryRenderHandoff(
    agentConfig: AgentEntity,
    reason: HandoffReason,
    state: AgentLifecycleState,
  ): Promise<string | undefined> {
    if (!agentConfig.handoffs || agentConfig.handoffs.length === 0) return undefined
    if (!this.handoffDeps) return undefined

    const { templateRenderer, fileAdapter, systemAdapter, injector, ledger } = this.handoffDeps
    const events = ledger ? await readAllEvents(ledger) : []

    return renderHandoff({
      agent: agentConfig,
      reason,
      state: this.getState(),
      events,
      turnRecords: state.turnRecords,
      failureCount: state.failures,
      hallucinationCount: state.hallucinations,
      templateRenderer,
      fileAdapter,
      systemAdapter,
      injector,
    })
  }

  async terminateAll(): Promise<void> {
    for (const [name, state] of this.lifecycle) {
      try {
        await state.transport.close()
      } catch (err) {
        console.warn(`Failed to close transport for agent ${name}:`, err)
      }
    }
    this.lifecycle.clear()
  }
}
