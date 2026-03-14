import { AgenticMessage } from './agentic-message.js'

export interface ConversationNode {
  readonly message: AgenticMessage
  readonly prev: ConversationNode | null
}

export interface Conversation {
  readonly systemMessage: string
  readonly messages: readonly AgenticMessage[]
  readonly tokenEstimate: number
  readonly length: number

  append(message: AgenticMessage): Conversation
}
