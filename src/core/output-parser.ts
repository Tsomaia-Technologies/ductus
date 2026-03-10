import { AgentChunk } from '../interfaces/agent-chunk.js'
import { Schema } from '../interfaces/schema.js'

function findLastJsonBlock(text: string): string | null {
  let endPos = -1
  let closer: '}' | ']' | null = null

  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === '}' || text[i] === ']') {
      endPos = i
      closer = text[i] as '}' | ']'
      break
    }
  }

  if (endPos === -1 || closer === null) return null

  const opener = closer === '}' ? '{' : '['
  let depth = 0

  for (let i = endPos; i >= 0; i--) {
    if (text[i] === closer) depth++
    if (text[i] === opener) depth--
    if (depth === 0) {
      return text.slice(i, endPos + 1)
    }
  }

  return null
}

function extractFromMarkdownFence(text: string): string | null {
  const match = text.match(/```(?:json|JSON)?\s*\n([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

function tryParseJson(text: string): unknown {
  return JSON.parse(text)
}

function extractJson(fullText: string): unknown {
  try {
    return tryParseJson(fullText)
  } catch {
    // full text is not valid JSON
  }

  const block = findLastJsonBlock(fullText)
  if (block) {
    try {
      return tryParseJson(block)
    } catch {
      // brace-matched block is not valid JSON
    }
  }

  const fenced = extractFromMarkdownFence(fullText)
  if (fenced) {
    try {
      return tryParseJson(fenced)
    } catch {
      // fenced block is not valid JSON
    }
  }

  throw new Error(
    `Failed to extract JSON from agent response: ${fullText.slice(0, 200)}`,
  )
}

export function parseAgentOutput(chunks: AgentChunk[], outputSchema: Schema): unknown {
  const dataChunks = chunks.filter((c): c is Extract<AgentChunk, { type: 'data' }> => c.type === 'data')

  if (dataChunks.length > 0) {
    const rawJson = dataChunks[dataChunks.length - 1].data
    return outputSchema.parse(rawJson)
  }

  const textChunks = chunks.filter((c): c is Extract<AgentChunk, { type: 'text' }> => c.type === 'text')

  if (textChunks.length === 0) {
    throw new Error('Agent produced no output')
  }

  const fullText = textChunks.map((c) => c.content).join('')
  const rawJson = extractJson(fullText)
  return outputSchema.parse(rawJson)
}
