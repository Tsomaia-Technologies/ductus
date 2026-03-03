import { AgentEntity, ContextOverflowPolicy } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { AdapterEntity, AgentAdapter } from '../interfaces/entities/adapter-entity.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'

export interface AgentTuple {
    agent: AgentEntity
    model: ModelEntity
    adapter: AdapterEntity
}

interface AgentLifecycleState {
    tokensUsed: number
    failures: number
    hallucinations: number
    turns: number
    adapter: AgentAdapter
}

/**
 * Modernized AgentDispatcher — manages adapter instances, tracks lifecycle state,
 * enforces limits, and executes skills.
 *
 * Created by createKernel from flow.agents tuples.
 * Injected into createReactionAdapter for invoke step handling.
 */
export class AgentDispatcher {
    private readonly agents: Map<string, AgentTuple> = new Map()
    private readonly lifecycle: Map<string, AgentLifecycleState> = new Map()

    constructor(agentTuples: AgentTuple[]) {
        for (const tuple of agentTuples) {
            this.agents.set(tuple.agent.name, tuple)
        }
    }

    /**
     * Invoke an agent's skill with the given input.
     * Handles lifecycle enforcement, adapter management, and response accumulation.
     */
    async *invoke(agentName: string, skillName: string, input: unknown): AsyncIterable<AgentChunk> {
        const tuple = this.agents.get(agentName)
        if (!tuple) {
            throw new Error(`Agent '${agentName}' not found.`)
        }

        const skill = tuple.agent.skill.find(s => s.name === skillName)
        if (!skill) {
            throw new Error(`Skill '${skillName}' not found on agent '${agentName}'.`)
        }

        const state = await this.getOrCreateLifecycleState(agentName)

        // Check limits before invoke
        await this.enforceLifecycleLimits(agentName, tuple.agent, state)

        // Validate input against skill schema
        const validatedInput = skill.input.schema.parse(input)

        // Render prompt — if skill has a template payload, use it; otherwise JSON-stringify the input
        const prompt = skill.input.payload
            ? skill.input.payload // TODO: integrate Moxite renderer here
            : JSON.stringify(validatedInput)

        // Call the adapter
        state.turns++
        let accumulatedText = ''

        for await (const chunk of state.adapter.process(prompt)) {
            yield chunk

            // Track metrics from chunks
            switch (chunk.type) {
                case 'text':
                    accumulatedText += chunk.content
                    break
                case 'usage':
                    state.tokensUsed += chunk.inputTokens + chunk.outputTokens
                    break
                case 'error':
                    state.failures++
                    break
            }
        }
    }

    /**
     * Invoke a skill and return the parsed structured output.
     * Used by the reaction adapter for pipeline processing and .case() matching.
     */
    async invokeAndParse(agentName: string, skillName: string, input: unknown): Promise<unknown> {
        const tuple = this.agents.get(agentName)
        if (!tuple) throw new Error(`Agent '${agentName}' not found.`)

        const skill = tuple.agent.skill.find(s => s.name === skillName)
        if (!skill) throw new Error(`Skill '${skillName}' not found on agent '${agentName}'.`)

        let accumulatedText = ''

        for await (const chunk of this.invoke(agentName, skillName, input)) {
            if (chunk.type === 'text') {
                accumulatedText += chunk.content
            }
        }

        return this.parseStructuredOutput(accumulatedText, skill)
    }

    /**
     * Terminate all active adapters. Called during kernel shutdown.
     */
    async terminateAll(): Promise<void> {
        for (const [, state] of this.lifecycle) {
            await state.adapter.terminate()
        }
        this.lifecycle.clear()
    }

    private async getOrCreateLifecycleState(agentName: string): Promise<AgentLifecycleState> {
        let state = this.lifecycle.get(agentName)
        if (!state) {
            const tuple = this.agents.get(agentName)!
            const adapter = tuple.adapter.create(tuple.agent, tuple.model)
            await adapter.initialize()

            state = {
                tokensUsed: 0,
                failures: 0,
                hallucinations: 0,
                turns: 0,
                adapter,
            }
            this.lifecycle.set(agentName, state)
        }
        return state
    }

    private async enforceLifecycleLimits(
        agentName: string,
        agentConfig: AgentEntity,
        state: AgentLifecycleState,
    ): Promise<void> {
        let needsReplacement = false

        if (agentConfig.maxFailures !== undefined && state.failures >= agentConfig.maxFailures) {
            needsReplacement = true
        }

        if (agentConfig.maxRecognizedHallucinations !== undefined
            && state.hallucinations >= agentConfig.maxRecognizedHallucinations) {
            needsReplacement = true
        }

        if (agentConfig.maxContextTokens !== undefined
            && state.tokensUsed >= agentConfig.maxContextTokens.value) {
            needsReplacement = true
        }

        if (agentConfig.scope) {
            const { type, amount } = agentConfig.scope as { type: string; amount?: number }
            if ((type === 'turn' || type === 'task') && amount !== undefined && state.turns >= amount) {
                needsReplacement = true
            }
        }

        if (needsReplacement) {
            await this.replaceAdapter(agentName, agentConfig.maxContextTokens?.overflowPolicy ?? 'fresh')
        }
    }

    private async replaceAdapter(agentName: string, policy: ContextOverflowPolicy): Promise<void> {
        const oldState = this.lifecycle.get(agentName)
        if (oldState) {
            await oldState.adapter.terminate()
        }

        const tuple = this.agents.get(agentName)!
        const newAdapter = tuple.adapter.create(tuple.agent, tuple.model)

        // TODO: for 'summarize' policy, call old adapter with summarization prompt before terminating
        // TODO: for 'truncate' policy, pass truncated context to new adapter's initialize()

        await newAdapter.initialize()

        this.lifecycle.set(agentName, {
            tokensUsed: 0,
            failures: 0,
            hallucinations: 0,
            turns: 0,
            adapter: newAdapter,
        })
    }

    private parseStructuredOutput(rawText: string, skill: SkillEntity): unknown {
        // Extract JSON from the raw text response
        const jsonMatch = rawText.match(/[\[{][\s\S]*[\]}]/)
        if (!jsonMatch) {
            throw new Error(`Failed to extract JSON from agent response for skill '${skill.name}'.`)
        }

        const parsed = JSON.parse(jsonMatch[0])
        return skill.output.parse(parsed)
    }
}
