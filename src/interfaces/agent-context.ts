export type MessageRole = 'system' | 'user' | 'assistant' | 'tool'

export interface ToolCallFunction {
  name: string
  arguments: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: ToolCallFunction
}

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
  authorId: string
  toolCalls: ToolCall[]
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

export interface AgentStats {
  inputTokens: number
  outputTokens: number
  turns: number
}

export interface AgentContext {
  messages: AgenticMessage[]
  stats: AgentStats
}
