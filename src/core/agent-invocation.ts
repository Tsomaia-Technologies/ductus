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
import { BaseEvent } from '../interfaces/event.js'
import { AssistantMessage, ToolMessage, UserMessage } from '../interfaces/agentic-message.js'
import { parseAgentOutput } from './output-parser.js'

export interface InvocationOptions<TState = unknown> {
  agent: AgentEntity
  skill: SkillEntity
  input: unknown
  conversation: Conversation
  transport: AgentTransport
  model: ModelEntity
  getState: () => TState
  use: Injector
  onEvent?: (event: BaseEvent) => void
}

export interface InvocationResult {
  output: unknown
  conversation: Conversation
  chunks: AgentChunk[]
  tokenUsage: { input: number; output: number }
}

export function toToolSchema(tool: ToolEntity): ToolSchema {
  return {
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.inputSchema, { $refStrategy: 'none' }) as Record<string, unknown>,
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
      use,
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
    let pendingToolCall: AgentToolCall | null = null

    for await (const chunk of resolvedTransport.send(request)) {
      currentChunks.push(chunk)
      allChunks.push(chunk)

      if (chunk.type === 'usage') {
        tokenUsage.input += chunk.inputTokens
        tokenUsage.output += chunk.outputTokens
      }

      if (chunk.type === 'tool-call') {
        pendingToolCall = chunk.toolCall
      }
    }

    if (!pendingToolCall) {
      return { conv: currentConv, finalChunks: currentChunks }
    }

    const textContent = currentChunks
      .filter((c): c is Extract<AgentChunk, { type: 'text' }> => c.type === 'text')
      .map((c) => c.content)
      .join('')

    const assistantMsg: AssistantMessage = {
      role: 'assistant',
      content: textContent,
      agentId: agentName,
      toolCall: pendingToolCall,
      timestamp: Date.now(),
    }
    currentConv = currentConv.append(assistantMsg)

    const { result: toolResult, error: toolError } = await executeTool(
      toolMap.get(pendingToolCall.name),
      pendingToolCall,
      getState,
      use,
      onEvent,
    )

    const toolMsg: ToolMessage = {
      role: 'tool',
      content: serializeToolResult(toolResult),
      toolCallId: pendingToolCall.id,
      name: pendingToolCall.name,
      error: toolError || undefined,
      timestamp: Date.now(),
    }
    currentConv = currentConv.append(toolMsg)
    currentNewFromIndex = currentConv.length - 2

    allChunks.push({
      type: 'tool-result',
      toolCallId: pendingToolCall.id,
      result: toolResult,
      timestamp: Date.now(),
    })
  }
}

export async function invokeAgent(options: InvocationOptions): Promise<InvocationResult> {
  const { agent, skill, input, getState, use, onEvent } = options

  const skillConfig = agent.skillConfigs?.get(skill.name)
  const { toolMap, toolSchemas } = gatherTools(agent, skill)

  const userMsg: UserMessage = {
    role: 'user',
    content: JSON.stringify(input),
    timestamp: Date.now(),
  }
  let conv = options.conversation.append(userMsg)

  const resolvedModel = skillConfig?.model ?? agent.defaultModel ?? options.model
  const resolvedTransport = skillConfig?.transport ?? agent.defaultTransport ?? options.transport

  const maxRetries = skill.maxRetries ?? 0
  let attempt = 0
  const allChunks: AgentChunk[] = []
  const tokenUsage = { input: 0, output: 0 }
  let newFromIndex = conv.length - 1

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
        await skill.assert(output, { use, getState })
      } catch (err) {
        if (attempt >= maxRetries) throw err
        attempt++

        const feedbackMsg: UserMessage = {
          role: 'user',
          content: `Your output failed validation: ${err instanceof Error ? err.message : String(err)}. Please try again.`,
          timestamp: Date.now(),
        }
        conv = conv.append(feedbackMsg)
        newFromIndex = conv.length - 1
        continue
      }
    }

    return { output, conversation: conv, chunks: allChunks, tokenUsage }
  }
}
