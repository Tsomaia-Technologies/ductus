import { Conversation } from './conversation.js'
import { AgentChunk } from './agent-chunk.js'

export interface ToolSchema {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface TransportRequest {
  conversation: Conversation
  newFromIndex: number
  tools?: ToolSchema[]
  model: string
  temperature?: number
  outputFormat?: 'text' | 'json'
}

export interface AgentTransport {
  send(request: TransportRequest): AsyncIterable<AgentChunk>
  close(): Promise<void>
}
