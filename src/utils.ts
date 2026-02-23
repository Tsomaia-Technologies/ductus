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
 * Finds the last complete root-level JSON object in the string.
 * Scans left-to-right, tracking bracket depth; when depth returns to 0 at '}',
 * records that object. Returns the last one found.
 * Handles nested structures (e.g. checks: [{"id":1}]) correctly.
 */
export function extractLastJsonObject(raw: string): string {
  const trimmed = raw.trim()
  let lastObject: string | null = null
  let objectStart = -1
  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i]

    if (escape) {
      escape = false
      continue
    }

    if (inString) {
      if (c === '\\') escape = true
      else if (c === '"') inString = false
      continue
    }

    if (c === '"') {
      inString = true
      continue
    }

    if (c === '[' || c === '{') {
      if (depth === 0 && c === '{') objectStart = i
      depth++
      continue
    }

    if (c === ']' || c === '}') {
      depth = Math.max(0, depth - 1)
      if (depth === 0 && c === '}' && objectStart >= 0) {
        lastObject = trimmed.slice(objectStart, i + 1)
      }
      continue
    }
  }

  if (lastObject === null) {
    if (trimmed.indexOf('{') === -1) {
      throw new Error('No JSON object found in response')
    }
    throw new Error('No complete JSON object found in response (unmatched brackets)')
  }
  return lastObject
}
