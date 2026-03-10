import { zodToJsonSchema } from 'zod-to-json-schema'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'
import { ToolEntity, ToolContext } from '../interfaces/entities/tool-entity.js'
import { AgentTransport, TransportRequest, ToolSchema } from '../interfaces/agent-transport.js'
import { Conversation } from '../interfaces/conversation.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { AgentToolCall } from '../interfaces/agent-tool-call.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { Injector } from '../interfaces/event-generator.js'
import { BaseEvent, BaseEventDefinition, Volatility } from '../interfaces/event.js'
import { AssistantMessage, ToolMessage, UserMessage } from '../interfaces/agentic-message.js'
import { ObservationConfig } from '../interfaces/observation-config.js'
import {
  AgentInvoked, AgentCompleted, AgentFailed,
  SkillInvoked, SkillCompleted, SkillFailed, SkillRetry,
  ToolRequested, ToolCompleted, AgentStreamChunk,
} from '../events/observation-events.js'
import { parseAgentOutput } from './output-parser.js'

export class AssertionExhaustedError extends Error {
  constructor(
    message: string,
    public readonly assertionFailures: number,
  ) {
    super(message)
    this.name = 'AssertionExhaustedError'
  }
}

export interface InvocationOptions<TState = unknown> {
  agent: AgentEntity
  skill: SkillEntity
  input: unknown
  conversation: Conversation
  transport: AgentTransport
  model?: ModelEntity
  getState: () => TState
  use: Injector
  onEvent?: (event: BaseEvent) => void
  observation?: ObservationConfig
}

export interface InvocationResult {
  output: unknown
  conversation: Conversation
  chunks: AgentChunk[]
  tokenUsage: { input: number; output: number; total: number }
  assertionFailures: number
}

function shouldEmit(
  eventDef: BaseEventDefinition,
  observation: ObservationConfig | undefined,
  skillName?: string,
): boolean {
  if (!observation) return false
  if (observation.observeAll) return true
  if (observation.events?.some(entry => entry.event.type === eventDef.type)) return true
  if (skillName && observation.skillEvents) {
    const skillObs = observation.skillEvents.find(se => se.skill.name === skillName)
    if (skillObs && (!skillObs.events || skillObs.events.length === 0)) return true
    if (skillObs?.events?.some(e => e.type === eventDef.type)) return true
  }
  return false
}

// Resolution priority: per-skill > per-event > observeAllVolatility > default ('volatile')
function resolveVolatility(
  eventDef: BaseEventDefinition,
  observation: ObservationConfig | undefined,
  skillName?: string,
): Volatility {
  if (!observation) return 'volatile'

  if (skillName && observation.skillEvents) {
    const skillObs = observation.skillEvents.find(se => se.skill.name === skillName)
    if (skillObs?.volatility) return skillObs.volatility
  }

  if (observation.events) {
    const entry = observation.events.find(e => e.event.type === eventDef.type)
    if (entry?.volatility) return entry.volatility
  }

  if (observation.observeAllVolatility) return observation.observeAllVolatility

  return 'volatile'
}

export function toToolSchema(tool: ToolEntity): ToolSchema {
  const jsonSchema = zodToJsonSchema(tool.inputSchema, { $refStrategy: 'none' }) as Record<string, unknown>
  const { $schema, ...parameters } = jsonSchema
  return {
    name: tool.name,
    description: tool.description,
    parameters,
  }
}

function gatherTools(
  agent: AgentEntity,
  skill: SkillEntity,
): { toolMap: Map<string, ToolEntity>; toolSchemas: ToolSchema[] } {
  const skillConfig = agent.skillConfigs?.get(skill.name)
  const sources: ToolEntity[] = [
    ...(agent.tools ?? []),
    ...(skill.tools ?? []),
    ...(skillConfig?.tools ?? []),
  ]

  const toolMap = new Map<string, ToolEntity>()
  for (const tool of sources) {
    toolMap.set(tool.name, tool)
  }

  return { toolMap, toolSchemas: [...toolMap.values()].map(toToolSchema) }
}

async function executeTool(
  tool: ToolEntity | undefined,
  toolCall: AgentToolCall,
  getState: () => unknown,
  use: Injector,
  onEvent?: (event: BaseEvent) => void,
): Promise<{ result: unknown; error: boolean }> {
  if (!tool) {
    return { result: `Error: Tool "${toolCall.name}" not found`, error: true }
  }

  try {
    const parsedArgs = JSON.parse(toolCall.arguments)
    const validatedArgs = tool.inputSchema.parse(parsedArgs)
    const ctx: ToolContext = {
      getState,
      use: <T>(token: string): T => use({ symbol: Symbol.for(token) }) as T,
      emit: onEvent ?? (() => {}),
    }
    const result = await tool.execute(validatedArgs, ctx)
    return { result, error: false }
  } catch (err) {
    return {
      result: `Error: ${err instanceof Error ? err.message : String(err)}`,
      error: true,
    }
  }
}

function serializeToolResult(result: unknown): string {
  if (typeof result === 'string') return result
  return JSON.stringify(result ?? null)
}

async function runToolLoop(
  conv: Conversation,
  newFromIndex: number,
  toolSchemas: ToolSchema[],
  toolMap: Map<string, ToolEntity>,
  resolvedTransport: AgentTransport,
  resolvedModel: ModelEntity,
  agentName: string,
  allChunks: AgentChunk[],
  tokenUsage: { input: number; output: number },
  getState: () => unknown,
  use: Injector,
  onEvent?: (event: BaseEvent) => void,
  observation?: ObservationConfig,
  skillName?: string,
): Promise<{ conv: Conversation; finalChunks: AgentChunk[] }> {
  let currentConv = conv
  let currentNewFromIndex = newFromIndex

  while (true) {
    const request: TransportRequest = {
      conversation: currentConv,
      newFromIndex: currentNewFromIndex,
      tools: toolSchemas.length > 0 ? toolSchemas : undefined,
      model: resolvedModel.model,
      temperature: resolvedModel.temperature ?? undefined,
    }

    const currentChunks: AgentChunk[] = []
    const pendingToolCalls: AgentToolCall[] = []

    for await (const chunk of resolvedTransport.send(request)) {
      currentChunks.push(chunk)
      allChunks.push(chunk)

      if (chunk.type === 'usage') {
        tokenUsage.input += chunk.inputTokens
        tokenUsage.output += chunk.outputTokens
      }

      if (chunk.type === 'tool-call') {
        pendingToolCalls.push(chunk.toolCall)
      }

      if (chunk.type === 'text' && onEvent && shouldEmit(AgentStreamChunk, observation, skillName)) {
        const evt = AgentStreamChunk({ agent: agentName, skill: skillName ?? '', chunk: { type: 'text', content: chunk.content } })
        onEvent({ ...evt, volatility: resolveVolatility(AgentStreamChunk, observation, skillName) })
      }
    }

    if (pendingToolCalls.length === 0) {
      return { conv: currentConv, finalChunks: currentChunks }
    }

    const textContent = currentChunks
      .filter((c): c is Extract<AgentChunk, { type: 'text' }> => c.type === 'text')
      .map((c) => c.content)
      .join('')

    const newMsgStart = currentConv.length

    const assistantMsg: AssistantMessage = {
      role: 'assistant',
      content: textContent,
      agentId: agentName,
      toolCall: pendingToolCalls[0],
      toolCalls: pendingToolCalls,
      timestamp: Date.now(),
    }
    currentConv = currentConv.append(assistantMsg)

    for (const tc of pendingToolCalls) {
      if (onEvent && shouldEmit(ToolRequested, observation, skillName)) {
        const evt = ToolRequested({ agent: agentName, tool: tc.name, arguments: tc.arguments })
        onEvent({ ...evt, volatility: resolveVolatility(ToolRequested, observation, skillName) })
      }

      const toolStart = Date.now()
      const { result: toolResult, error: toolError } = await executeTool(
        toolMap.get(tc.name),
        tc,
        getState,
        use,
        onEvent,
      )
      const toolDurationMs = Date.now() - toolStart

      if (onEvent && shouldEmit(ToolCompleted, observation, skillName)) {
        const summary = typeof toolResult === 'string' ? toolResult.slice(0, 200) : JSON.stringify(toolResult).slice(0, 200)
        const evt = ToolCompleted({ agent: agentName, tool: tc.name, durationMs: toolDurationMs, resultSummary: summary })
        onEvent({ ...evt, volatility: resolveVolatility(ToolCompleted, observation, skillName) })
      }

      const toolMsg: ToolMessage = {
        role: 'tool',
        content: serializeToolResult(toolResult),
        toolCallId: tc.id,
        name: tc.name,
        error: toolError || undefined,
        timestamp: Date.now(),
      }
      currentConv = currentConv.append(toolMsg)

      allChunks.push({
        type: 'tool-result',
        toolCallId: tc.id,
        result: toolResult,
        timestamp: Date.now(),
      })
    }

    currentNewFromIndex = newMsgStart
  }
}

export async function invokeAgent(options: InvocationOptions): Promise<InvocationResult> {
  const { agent, skill, input, getState, use, onEvent } = options
  const observation = options.observation ?? agent.observation

  const skillConfig = agent.skillConfigs?.get(skill.name)
  const { toolMap, toolSchemas } = gatherTools(agent, skill)

  if (onEvent && shouldEmit(AgentInvoked, observation)) {
    const evt = AgentInvoked({ agent: agent.name, skill: skill.name, inputHash: '' })
    onEvent({ ...evt, volatility: resolveVolatility(AgentInvoked, observation) })
  }
  if (onEvent && shouldEmit(SkillInvoked, observation, skill.name)) {
    const evt = SkillInvoked({ agent: agent.name, skill: skill.name, inputHash: '' })
    onEvent({ ...evt, volatility: resolveVolatility(SkillInvoked, observation, skill.name) })
  }

  const userMsg: UserMessage = {
    role: 'user',
    content: JSON.stringify(input),
    timestamp: Date.now(),
  }
  let conv = options.conversation.append(userMsg)

  const resolvedModel = skillConfig?.model ?? options.model ?? agent.defaultModel
  if (!resolvedModel) {
    throw new Error(`No model configured for agent '${agent.name}'. Set defaultModel on the agent or provide a model in the flow registration.`)
  }
  const resolvedTransport = skillConfig?.transport ?? options.transport ?? agent.defaultTransport

  const maxRetries = skill.maxRetries ?? 0
  let attempt = 0
  let assertionFailures = 0
  const allChunks: AgentChunk[] = []
  const tokenUsage = { input: 0, output: 0 }
  let newFromIndex = conv.length - 1
  const skillStart = Date.now()

  while (true) {
    const loopResult = await runToolLoop(
      conv,
      newFromIndex,
      toolSchemas,
      toolMap,
      resolvedTransport,
      resolvedModel,
      agent.name,
      allChunks,
      tokenUsage,
      getState,
      use,
      onEvent,
      observation,
      skill.name,
    )

    conv = loopResult.conv
    const finalChunks = loopResult.finalChunks

    const output = parseAgentOutput(finalChunks, skill.output)

    const assistantContent = finalChunks
      .filter((c): c is Extract<AgentChunk, { type: 'text' }> => c.type === 'text')
      .map((c) => c.content)
      .join('')

    conv = conv.append({
      role: 'assistant' as const,
      content: assistantContent,
      agentId: agent.name,
      timestamp: Date.now(),
    })

    if (skill.assert) {
      try {
        await skill.assert(output, { use: <T>(token: string): T => use({ symbol: Symbol.for(token) }) as T, getState })
      } catch (err) {
        assertionFailures++
        const errorMsg = err instanceof Error ? err.message : String(err)

        if (attempt >= maxRetries) {
          if (onEvent) {
            if (shouldEmit(SkillFailed, observation, skill.name)) {
              const evt = SkillFailed({ agent: agent.name, skill: skill.name, error: errorMsg, retriesExhausted: true })
              onEvent({ ...evt, volatility: resolveVolatility(SkillFailed, observation, skill.name) })
            }
            if (shouldEmit(AgentFailed, observation)) {
              const evt = AgentFailed({ agent: agent.name, skill: skill.name, error: errorMsg })
              onEvent({ ...evt, volatility: resolveVolatility(AgentFailed, observation) })
            }
          }
          throw new AssertionExhaustedError(
            `Skill assertion failed after ${maxRetries + 1} attempts: ${errorMsg}`,
            assertionFailures,
          )
        }

        attempt++

        if (onEvent && shouldEmit(SkillRetry, observation, skill.name)) {
          const evt = SkillRetry({ agent: agent.name, skill: skill.name, attempt, maxRetries, error: errorMsg })
          onEvent({ ...evt, volatility: resolveVolatility(SkillRetry, observation, skill.name) })
        }

        const feedbackMsg: UserMessage = {
          role: 'user',
          content: `Your output failed validation: ${errorMsg}. Please try again.`,
          timestamp: Date.now(),
        }
        conv = conv.append(feedbackMsg)
        newFromIndex = conv.length - 1
        continue
      }
    }

    const skillDurationMs = Date.now() - skillStart

    if (onEvent) {
      if (shouldEmit(SkillCompleted, observation, skill.name)) {
        const evt = SkillCompleted({ agent: agent.name, skill: skill.name, durationMs: skillDurationMs })
        onEvent({ ...evt, volatility: resolveVolatility(SkillCompleted, observation, skill.name) })
      }
      if (shouldEmit(AgentCompleted, observation)) {
        const evt = AgentCompleted({
          agent: agent.name,
          skill: skill.name,
          durationMs: skillDurationMs,
          tokenUsage: { input: tokenUsage.input, output: tokenUsage.output, total: tokenUsage.input + tokenUsage.output },
        })
        onEvent({ ...evt, volatility: resolveVolatility(AgentCompleted, observation) })
      }
    }

    const totalTokens = tokenUsage.input + tokenUsage.output
    return { output, conversation: conv, chunks: allChunks, tokenUsage: { ...tokenUsage, total: totalTokens }, assertionFailures }
  }
}
