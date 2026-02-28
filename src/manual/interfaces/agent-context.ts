import { AgenticMessage } from './agentic-message.js'

export interface AgentStats {
  inputTokens: number
  outputTokens: number
  turns: number
}

export interface AgentContext {
  messages: AgenticMessage[]
  stats: AgentStats
}
