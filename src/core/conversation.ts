import { AgenticMessage } from '../interfaces/agentic-message.js'
import { Conversation, ConversationNode } from '../interfaces/conversation.js'

const EMPTY_MESSAGES: readonly AgenticMessage[] = Object.freeze([])

export class ConversationImpl implements Conversation {
  readonly systemMessage: string
  readonly tokenEstimate: number
  readonly length: number

  private readonly head: ConversationNode | null

  private constructor(
    systemMessage: string,
    head: ConversationNode | null,
    length: number,
    tokenEstimate: number,
  ) {
    this.systemMessage = systemMessage
    this.head = head
    this.length = length
    this.tokenEstimate = tokenEstimate
  }

  static create(systemMessage: string): ConversationImpl {
    return new ConversationImpl(systemMessage, null, 0, 0)
  }

  get messages(): readonly AgenticMessage[] {
    if (this.head === null) return EMPTY_MESSAGES

    const result: AgenticMessage[] = new Array(this.length)
    let node: ConversationNode | null = this.head
    for (let i = this.length - 1; i >= 0; i--) {
      result[i] = node!.message
      node = node!.prev
    }
    return Object.freeze(result)
  }

  append(message: AgenticMessage): ConversationImpl {
    const node: ConversationNode = { message, prev: this.head }
    const tokens = Math.ceil(message.content.length / 4)
    return new ConversationImpl(
      this.systemMessage,
      node,
      this.length + 1,
      this.tokenEstimate + tokens,
    )
  }
}
