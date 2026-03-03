import { ZodSchema } from 'zod/v3'
import { zodToJsonSchema } from 'zod-to-json-schema'

export function toJsonSchema<T>(schema: ZodSchema<T>): string {
  return JSON.stringify(
    zodToJsonSchema(
      schema,
    ),
    null,
    2,
  )
}
