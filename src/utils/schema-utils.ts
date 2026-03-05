import { ZodSchema, ZodType } from 'zod/v3'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { isObject } from './guards.js'

export function toJsonSchema<T>(schema: ZodSchema<T>): string {
  return JSON.stringify(
    zodToJsonSchema(
      schema,
    ),
    null,
    2,
  )
}

export function isSchemaType(input: unknown): input is ZodType {
  return isObject(input)
    && '_def' in input
    && 'parse' in input
    && typeof input.parse === 'function'
}
