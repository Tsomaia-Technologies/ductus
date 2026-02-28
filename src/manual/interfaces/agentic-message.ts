import { AgentToolCall } from './agent-tool-call.js'

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface BaseMessage {
  role: MessageRole
  content: string
  timestamp: number
}

export interface SystemMessage extends BaseMessage {
  role: 'system'
}

export interface UserMessage extends BaseMessage {
  role: 'user'
}

export interface AssistantMessage extends BaseMessage {
  role: 'assistant'
  agentId: string
  toolCall?: AgentToolCall
}

export interface ToolMessage extends BaseMessage {
  role: 'tool'
  toolCallId: string
  name: string
  error?: boolean
}

export type AgenticMessage =
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage
