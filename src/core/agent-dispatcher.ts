import { AgentEntity, ContextOverflowPolicy } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { AdapterEntity, AgentAdapter } from '../interfaces/entities/adapter-entity.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { AgentContext } from '../interfaces/agent-context.js'
import { AgenticMessage, UserMessage, AssistantMessage } from '../interfaces/agentic-message.js'
import { DEFAULT_SUMMARIZATION_PROMPT } from '../system/system-prompts.js'

export interface AgentTuple {
    agent: AgentEntity
    model: ModelEntity
    adapter: AdapterEntity
}

/**
 * Render function signature matching Moxite's render().
 * Injected as a dependency — decouples Ductus from Moxite import.
 */
export type TemplateRenderer = (template: string, context: Record<string, any>) => string

interface AgentLifecycleState {
    tokensUsed: number
    failures: number
    hallucinations: number
    turns: number
    adapter: AgentAdapter
    messages: AgenticMessage[]
}

export interface AgentDispatcherOptions {
    agents: AgentTuple[]
    templateRenderer?: TemplateRenderer
    summarizationPrompt?: string
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
    private readonly templateRenderer?: TemplateRenderer
    private readonly summarizationPrompt: string

    constructor(options: AgentDispatcherOptions) {
        for (const tuple of options.agents) {
            this.agents.set(tuple.agent.name, tuple)
        }
        this.templateRenderer = options.templateRenderer
        this.summarizationPrompt = options.summarizationPrompt ?? DEFAULT_SUMMARIZATION_PROMPT
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

        // Render prompt
        const prompt = this.renderPrompt(skill, validatedInput)

        // Track user message
        state.messages.push({
            role: 'user',
            content: prompt,
            timestamp: Date.now(),
        } satisfies UserMessage)

        // Call the adapter
        state.turns++
        let accumulatedText = ''

        for await (const chunk of state.adapter.process(prompt)) {
            yield chunk

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

        // Track assistant message
        state.messages.push({
            role: 'assistant',
            content: accumulatedText,
            agentId: agentName,
            timestamp: Date.now(),
        } satisfies AssistantMessage)
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

    private renderPrompt(skill: SkillEntity, validatedInput: unknown): string {
        if (skill.input.payload && this.templateRenderer) {
            const context = typeof validatedInput === 'object' && validatedInput !== null
                ? validatedInput as Record<string, any>
                : { input: validatedInput }
            return this.templateRenderer(skill.input.payload, context)
        }

        return JSON.stringify(validatedInput)
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
                messages: [],
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
        const tuple = this.agents.get(agentName)!
        let initialContext: AgentContext | undefined

        switch (policy) {
            case 'summarize': {
                if (oldState && oldState.messages.length > 0) {
                    // Ask the existing adapter to summarize before we terminate it
                    let summary = ''
                    for await (const chunk of oldState.adapter.process(this.summarizationPrompt)) {
                        if (chunk.type === 'text') {
                            summary += chunk.content
                        }
                    }

                    initialContext = {
                        messages: [{
                            role: 'system' as const,
                            content: `Previous conversation summary:\n${summary}`,
                            timestamp: Date.now(),
                        }],
                        stats: {
                            inputTokens: 0,
                            outputTokens: 0,
                            turns: 0,
                        },
                    }
                }
                break
            }

            case 'truncate': {
                if (oldState && oldState.messages.length > 0) {
                    // Estimate tokens: ~4 chars per token, keep last messages within half the budget
                    const budget = tuple.agent.maxContextTokens?.value ?? Infinity
                    const charBudget = (budget / 2) * 4
                    let charCount = 0
                    const truncated: AgenticMessage[] = []

                    for (let i = oldState.messages.length - 1; i >= 0; i--) {
                        const msg = oldState.messages[i]
                        charCount += msg.content.length
                        if (charCount > charBudget) break
                        truncated.unshift(msg)
                    }

                    initialContext = {
                        messages: truncated,
                        stats: {
                            inputTokens: 0,
                            outputTokens: 0,
                            turns: 0,
                        },
                    }
                }
                break
            }

            case 'fresh':
                // No context carried over
                break
        }

        // Terminate old adapter
        if (oldState) {
            await oldState.adapter.terminate()
        }

        // Create fresh adapter
        const newAdapter = tuple.adapter.create(tuple.agent, tuple.model)
        await newAdapter.initialize(initialContext)

        this.lifecycle.set(agentName, {
            tokensUsed: 0,
            failures: 0,
            hallucinations: 0,
            turns: 0,
            adapter: newAdapter,
            messages: initialContext?.messages ? [...initialContext.messages] : [],
        })
    }

    private parseStructuredOutput(rawText: string, skill: SkillEntity): unknown {
        const jsonMatch = rawText.match(/[\[{][\s\S]*[\]}]/)
        if (!jsonMatch) {
            throw new Error(`Failed to extract JSON from agent response for skill '${skill.name}'.`)
        }

        const parsed = JSON.parse(jsonMatch[0])
        return skill.output.parse(parsed)
    }
}
