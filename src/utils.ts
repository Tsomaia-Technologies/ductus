import { zodToJsonSchema } from 'zod-to-json-schema'
import { ZodSchema } from 'zod/v3'

export function toJsonSchema<T>(schema: ZodSchema<T>): string {
  return JSON.stringify(
    zodToJsonSchema(
      schema,
    ),
    null,
    2,
  )
}

export function extractJsonArray(raw: string): string {
  const trimmed = raw.trim()

  let stripped = trimmed
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/i, '')
    .trim()

  const start = stripped.indexOf('[')
  if (start === -1) {
    throw new Error('No JSON array found in Architect response')
  }

  let depth = 0
  let inString = false
  let escape = false
  let i = start

  while (i < stripped.length) {
    const c = stripped[i]

    if (escape) {
      escape = false
      i++
      continue
    }

    if (inString) {
      if (c === '\\') escape = true
      else if (c === '"') inString = false
      i++
      continue
    }

    if (c === '"') {
      inString = true
      i++
      continue
    }

    if (c === '[' || c === '{') {
      depth++
      i++
      continue
    }

    if (c === ']' || c === '}') {
      depth--
      if (depth === 0 && c === ']') {
        return stripped.slice(start, i + 1)
      }
      i++
      continue
    }

    i++
  }

  throw new Error(
    'No complete JSON array found in Architect response (unmatched brackets)',
  )
}
