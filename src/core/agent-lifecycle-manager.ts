import { AgentLifecycleState, AgentTuple } from '../interfaces/agent-lifecycle.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { AgentPromptComposer } from './agent-prompt-composer.js'
import { ConversationImpl } from './conversation.js'

export class AgentLifecycleManager {
  private readonly lifecycle: Map<string, AgentLifecycleState> = new Map()

  constructor(
    private readonly agents: Map<string, AgentTuple>,
    private readonly promptComposer: AgentPromptComposer,
    private readonly getState: () => unknown,
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

    let needsReset = state.failures >= maxFailures || state.hallucinations >= maxHallucinations

    if (!needsReset && agentConfig.scope) {
      const scope = agentConfig.scope
      if (scope.type === 'turn' || scope.type === 'task') {
        if (state.turns >= scope.amount) {
          needsReset = true
        }
      }
    }

    if (needsReset) {
      const systemMessage = await this.promptComposer.compose(agentConfig, this.getState())
      state.conversation = ConversationImpl.create(systemMessage)
      state.failures = 0
      state.hallucinations = 0
      state.turns = 0
      state.turnRecords = []
    }
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
