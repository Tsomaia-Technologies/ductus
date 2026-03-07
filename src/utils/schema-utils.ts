import { ZodSchema, ZodType } from 'zod/v3'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { isObject } from './guards.js'
import * as zod from 'zod/v3'

export const literal = zod.literal
export const boolean = zod.boolean
export const string = zod.string
export const number = zod.number
export const _null = zod.null
export const nullable = zod.nullable
export const date = zod.date
export const union = zod.union
export const discriminatedUnion = zod.discriminatedUnion
export const object = zod.strictObject
export const array = zod.array
export const _enum = zod.enum

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
