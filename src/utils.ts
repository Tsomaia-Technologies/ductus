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

export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()

  let stripped = trimmed
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/i, '')
    .trim()

  const start = stripped.indexOf('{')
  if (start === -1) {
    throw new Error('No JSON object found in response')
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
      if (depth === 0 && c === '}') {
        return stripped.slice(start, i + 1)
      }
      i++
      continue
    }

    i++
  }

  throw new Error(
    'No complete JSON object found in response (unmatched brackets)',
  )
}

/**
 * Finds the last complete JSON object in the string. Useful when output contains
 * multiple objects (e.g. tool results) and we need the final one.
 */
export function extractLastJsonObject(raw: string): string {
  const trimmed = raw.trim()
  const start = trimmed.lastIndexOf('{')
  if (start === -1) {
    throw new Error('No JSON object found in response')
  }

  let depth = 0
  let inString = false
  let escape = false
  let i = start

  while (i < trimmed.length) {
    const c = trimmed[i]

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
      if (depth === 0 && c === '}') {
        return trimmed.slice(start, i + 1)
      }
      i++
      continue
    }

    i++
  }

  throw new Error(
    'No complete JSON object found in response (unmatched brackets)',
  )
}
