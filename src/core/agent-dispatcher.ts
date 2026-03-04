import { AgentEntity, AsyncTemplateResolver, HandoffReason } from '../interfaces/entities/agent-entity.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { AdapterEntity, AgentAdapter } from '../interfaces/entities/adapter-entity.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { AgentContext } from '../interfaces/agent-context.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { EventLedger } from '../interfaces/event-ledger.js'
import { Injector } from '../interfaces/event-generator.js'

export interface AgentTuple {
    agent: AgentEntity
    model: ModelEntity
    adapter: AdapterEntity
}

/**
 * Generic template renderer. Engine-agnostic — user wraps their preferred
 * engine (Moxite, Handlebars, Nunjucks, etc.) in this interface.
 * Engine-specific features (pipes, helpers, filters) are configured
 * in the user's closure, invisible to the framework.
 */
export type TemplateRenderer = (template: string, context: Record<string, any>) => string | Promise<string>

export interface AnnotatedEvent {
    type: string
    payload: unknown
    sequence: number
    timestamp: number
    isFailed: boolean
}

interface TurnRecord {
    turnNumber: number
    startSequence: number
    endSequence: number
    failed: boolean
}

interface AgentLifecycleState {
    tokensUsed: number
    failures: number
    hallucinations: number
    turns: number
    adapter: AgentAdapter
    turnRecords: TurnRecord[]
    currentTurnStartSequence: number
}

export interface AgentDispatcherOptions {
    agents: AgentTuple[]
    templateRenderer?: TemplateRenderer
    ledger?: EventLedger<BaseEvent>
    stateAccessor?: () => unknown
    injector?: Injector
}

const DEFAULT_HEAD_EVENTS = 2
const DEFAULT_TAIL_EVENTS = 10

const AGENT_SUMMARY_PROMPT = 'Provide a concise summary of our conversation so far, including key decisions, context, and outputs.'

/**
 * Manages adapter lifecycle, tracks turn boundaries, enforces limits,
 * composes system prompts (persona + systemPrompt + handoff), and
 * renders event+state handoff context for replacement adapters.
 */
export class AgentDispatcher {
    private readonly agents: Map<string, AgentTuple> = new Map()
    private readonly lifecycle: Map<string, AgentLifecycleState> = new Map()
    private readonly templateRenderer?: TemplateRenderer
    private readonly ledger?: EventLedger<BaseEvent>
    private readonly stateAccessor?: () => unknown
    private readonly injector?: Injector
    private lastKnownSequence = 0

    constructor(options: AgentDispatcherOptions) {
        for (const tuple of options.agents) {
            this.agents.set(tuple.agent.name, tuple)
        }
        this.templateRenderer = options.templateRenderer
        this.ledger = options.ledger
        this.stateAccessor = options.stateAccessor
        this.injector = options.injector
    }

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
        await this.enforceLifecycleLimits(agentName, tuple.agent, state)

        const validatedInput = skill.input.schema.parse(input)
        const prompt = await this.renderPrompt(skill, validatedInput)

        state.turns++
        state.currentTurnStartSequence = this.lastKnownSequence + 1

        let accumulatedText = ''
        let turnFailed = false

        for await (const chunk of state.adapter.process(prompt)) {
            yield chunk

            switch (chunk.type) {
                case 'text':
                    accumulatedText += chunk.content
                    break
                case 'usage':
                    state.tokensUsed += chunk.inputTokens + chunk.outputTokens
                    this.lastKnownSequence = Math.max(
                        this.lastKnownSequence,
                        state.currentTurnStartSequence + state.turns,
                    )
                    break
                case 'error':
                    state.failures++
                    turnFailed = true
                    break
            }
        }

        state.turnRecords.push({
            turnNumber: state.turns,
            startSequence: state.currentTurnStartSequence,
            endSequence: this.lastKnownSequence,
            failed: turnFailed,
        })
    }

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

    async terminateAll(): Promise<void> {
        for (const [, state] of this.lifecycle) {
            await state.adapter.terminate()
        }
        this.lifecycle.clear()
    }

    // ── Prompt Composition ────────────────────────────────────────────────

    /**
     * Composes the full system message from persona + systemPrompt.
     * Resolves async template resolvers if present.
     */
    private async composeSystemMessage(agentConfig: AgentEntity): Promise<string> {
        const parts: string[] = []

        // Layer 1: Persona
        const persona = await this.resolvePersona(agentConfig)
        if (persona) parts.push(persona)

        // Layer 2: SystemPrompt (runtime state)
        const systemPrompt = await this.resolveSystemPrompt(agentConfig)
        if (systemPrompt) parts.push(systemPrompt)

        return parts.join('\n\n')
    }

    private async resolvePersona(agentConfig: AgentEntity): Promise<string | undefined> {
        const { persona } = agentConfig

        if (typeof persona === 'function') {
            // Async resolver
            if (!this.injector) return undefined
            const resolved = await persona(this.injector, agentConfig)
            return this.formatPersona(agentConfig, resolved)
        }

        return this.formatPersona(agentConfig, persona)
    }

    private async formatPersona(
        agentConfig: AgentEntity,
        value: string | { template: string },
    ): Promise<string | undefined> {
        if (typeof value === 'string') {
            // Static string — auto-append rules
            const parts = [value]

            if (agentConfig.rules.length > 0) {
                const ruleLines = agentConfig.rules.map(r => `- ${r}`).join('\n')
                parts.push(`\nRules:\n${ruleLines}`)
            }
            for (const ruleset of agentConfig.rulesets) {
                const ruleLines = ruleset.rules.map(r => `- ${r}`).join('\n')
                parts.push(`\n${ruleset.name}:\n${ruleLines}`)
            }

            return parts.join('')
        }

        // Template — render with agent config
        if (!this.templateRenderer) return undefined
        return await this.awaitRendered(
            this.templateRenderer(value.template, {
                agent: { name: agentConfig.name, role: agentConfig.role },
                rules: agentConfig.rules,
                rulesets: agentConfig.rulesets,
            }),
        )
    }

    private async resolveSystemPrompt(agentConfig: AgentEntity): Promise<string | undefined> {
        const { systemPrompt } = agentConfig
        if (!systemPrompt) return undefined

        if (typeof systemPrompt === 'function') {
            if (!this.injector) return undefined
            const resolved = await systemPrompt(this.injector, agentConfig)
            // resolved is string or { template }
            const templatePath = typeof resolved === 'string' ? resolved : resolved.template
            if (!this.templateRenderer || !this.stateAccessor) return templatePath
            return this.awaitRendered(
                this.templateRenderer(templatePath, { state: this.stateAccessor() }),
            )
        }

        // Static template path
        if (!this.templateRenderer || !this.stateAccessor) return undefined
        return this.awaitRendered(
            this.templateRenderer(systemPrompt, { state: this.stateAccessor() }),
        )
    }

    // ── Skill Prompt Rendering ────────────────────────────────────────────

    private async renderPrompt(skill: SkillEntity, validatedInput: unknown): Promise<string> {
        if (skill.input.payload && this.templateRenderer) {
            const context = typeof validatedInput === 'object' && validatedInput !== null
                ? validatedInput as Record<string, any>
                : { input: validatedInput }
            return this.awaitRendered(
                this.templateRenderer(skill.input.payload, context),
            )
        }

        return JSON.stringify(validatedInput)
    }

    // ── Lifecycle Management ──────────────────────────────────────────────

    private async getOrCreateLifecycleState(agentName: string): Promise<AgentLifecycleState> {
        let state = this.lifecycle.get(agentName)
        if (!state) {
            const tuple = this.agents.get(agentName)!
            const adapter = tuple.adapter.create(tuple.agent, tuple.model)

            const systemMessage = await this.composeSystemMessage(tuple.agent)

            const context: AgentContext = {
                messages: [{
                    role: 'system' as const,
                    content: systemMessage,
                    timestamp: Date.now(),
                }],
                stats: { inputTokens: 0, outputTokens: 0, turns: 0 },
            }

            await adapter.initialize(context)

            state = {
                tokensUsed: 0,
                failures: 0,
                hallucinations: 0,
                turns: 0,
                adapter,
                turnRecords: [],
                currentTurnStartSequence: 0,
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
        let reason: HandoffReason | null = null

        if (agentConfig.maxContextTokens !== undefined
            && state.tokensUsed >= agentConfig.maxContextTokens) {
            reason = 'overflow'
        }

        if (!reason && agentConfig.maxFailures !== undefined
            && state.failures >= agentConfig.maxFailures) {
            reason = 'failure'
        }

        if (!reason && agentConfig.maxRecognizedHallucinations !== undefined
            && state.hallucinations >= agentConfig.maxRecognizedHallucinations) {
            reason = 'failure'
        }

        if (!reason && agentConfig.scope) {
            const { type, amount } = agentConfig.scope as { type: string; amount?: number }
            if ((type === 'turn' || type === 'task') && amount !== undefined && state.turns >= amount) {
                reason = 'scope'
            }
        }

        if (reason) {
            await this.replaceAdapter(agentName, reason)
        }
    }

    // ── Adapter Replacement ───────────────────────────────────────────────

    private async replaceAdapter(agentName: string, reason: HandoffReason): Promise<void> {
        const oldState = this.lifecycle.get(agentName)
        const tuple = this.agents.get(agentName)!

        const handoff = tuple.agent.handoffs?.find(h => h.reason === reason)
        let handoffContent: string | undefined

        if (handoff && this.templateRenderer && this.ledger && this.stateAccessor) {
            // Resolve handoff template (may be async)
            let templatePath: string
            if (typeof handoff.template === 'function') {
                if (!this.injector) {
                    templatePath = ''
                } else {
                    const resolved = await handoff.template(this.injector, tuple.agent)
                    templatePath = typeof resolved === 'string' ? resolved : resolved.template
                }
            } else {
                templatePath = handoff.template
            }

            if (templatePath) {
                const allEvents = await this.readAllEvents()
                const failedSequences = this.getFailedSequences(oldState)

                const annotated = allEvents.map(e => ({
                    type: e.type,
                    payload: e.payload,
                    sequence: e.sequenceNumber,
                    timestamp: e.timestamp,
                    isFailed: failedSequences.has(e.sequenceNumber),
                }))

                const headCount = handoff.headEvents ?? DEFAULT_HEAD_EVENTS
                const tailCount = handoff.tailEvents ?? DEFAULT_TAIL_EVENTS

                let headEvents: AnnotatedEvent[]
                let tailEvents: AnnotatedEvent[]

                if (annotated.length <= headCount + tailCount) {
                    headEvents = annotated
                    tailEvents = []
                } else {
                    headEvents = annotated.slice(0, headCount)
                    tailEvents = annotated.slice(-tailCount)

                    if (reason === 'failure') {
                        const failedEvents = annotated.filter(e => e.isFailed)
                        const tailSequences = new Set(tailEvents.map(e => e.sequence))
                        for (const fe of failedEvents) {
                            if (!tailSequences.has(fe.sequence)) {
                                tailEvents.push(fe)
                            }
                        }
                        tailEvents.sort((a, b) => a.sequence - b.sequence)
                    }
                }

                // Opt-in agent summary for scope handoffs
                let agentSummary: string | undefined
                if (handoff.agentSummary && reason === 'scope' && oldState) {
                    let summary = ''
                    for await (const chunk of oldState.adapter.process(AGENT_SUMMARY_PROMPT)) {
                        if (chunk.type === 'text') {
                            summary += chunk.content
                        }
                    }
                    agentSummary = summary
                }

                handoffContent = await this.awaitRendered(
                    this.templateRenderer(templatePath, {
                        reason,
                        state: this.stateAccessor(),
                        headEvents,
                        tailEvents,
                        failureCount: oldState?.failures ?? 0,
                        hallucinationCount: oldState?.hallucinations ?? 0,
                        agent: {
                            name: tuple.agent.name,
                            role: tuple.agent.role,
                        },
                        agentSummary,
                    }),
                )
            }
        }

        // Terminate old adapter
        if (oldState) {
            await oldState.adapter.terminate()
        }

        // Create new adapter with composed system message + handoff context
        const newAdapter = tuple.adapter.create(tuple.agent, tuple.model)
        const systemMessage = await this.composeSystemMessage(tuple.agent)

        const fullMessage = handoffContent
            ? `${systemMessage}\n\n${handoffContent}`
            : systemMessage

        const context: AgentContext = {
            messages: [{
                role: 'system' as const,
                content: fullMessage,
                timestamp: Date.now(),
            }],
            stats: { inputTokens: 0, outputTokens: 0, turns: 0 },
        }

        await newAdapter.initialize(context)

        this.lifecycle.set(agentName, {
            tokensUsed: 0,
            failures: 0,
            hallucinations: 0,
            turns: 0,
            adapter: newAdapter,
            turnRecords: [],
            currentTurnStartSequence: 0,
        })
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private getFailedSequences(state: AgentLifecycleState | undefined): Set<number> {
        const set = new Set<number>()
        if (!state) return set

        for (const turn of state.turnRecords) {
            if (turn.failed) {
                for (let seq = turn.startSequence; seq <= turn.endSequence; seq++) {
                    set.add(seq)
                }
            }
        }
        return set
    }

    private async readAllEvents(): Promise<CommittedEvent<BaseEvent>[]> {
        if (!this.ledger) return []

        const events: CommittedEvent<BaseEvent>[] = []
        for await (const event of this.ledger.readEvents()) {
            events.push(event)
        }
        return events
    }

    private async awaitRendered(result: string | Promise<string>): Promise<string> {
        return result
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
