import { AgentToolCall } from './agent-tool-call.js'

export interface AgentChunkBase {
  type: string
  timestamp: number
}

export interface AgentChunkReasoning extends AgentChunkBase {
  type: 'reasoning'
  content: string
}

export interface AgentChunkText extends AgentChunkBase {
  type: 'text'
  content: string
}

export interface AgentChunkToolCall extends AgentChunkBase {
  type: 'tool-call'
  toolCall: AgentToolCall
}

export interface AgentChunkToolResult extends AgentChunkBase {
  type: 'tool-result'
  toolCallId: string
  result: unknown
}

export interface AgentChunkError extends AgentChunkBase {
  type: 'error'
  reason: string
}

export interface AgentChunkUsage extends AgentChunkBase {
  type: 'usage'
  inputTokens: number
  outputTokens: number
}

export interface AgentChunkData extends AgentChunkBase {
  type: 'data'
  data: unknown
}

export interface AgentChunkComplete extends AgentChunkBase {
  type: 'complete'
}

export type AgentChunk =
  | AgentChunkReasoning
  | AgentChunkText
  | AgentChunkToolCall
  | AgentChunkToolResult
  | AgentChunkError
  | AgentChunkUsage
  | AgentChunkData
  | AgentChunkComplete
