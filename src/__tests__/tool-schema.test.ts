import { z } from 'zod/v3'
import { toToolSchema } from '../core/agent-invocation.js'
import { ToolEntity } from '../interfaces/entities/tool-entity.js'

function makeTool(inputSchema: z.ZodSchema, overrides?: Partial<ToolEntity>): ToolEntity {
  return {
    name: 'test-tool',
    description: 'A test tool',
    inputSchema,
    execute: async () => null,
    ...overrides,
  }
}

describe('toToolSchema', () => {
  it('converts a simple object schema with required fields', () => {
    const schema = z.object({ path: z.string() })
    const result = toToolSchema(makeTool(schema))

    expect(result.name).toBe('test-tool')
    expect(result.description).toBe('A test tool')
    expect(result.parameters).toMatchObject({
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
    })
  })

  it('converts an empty object schema', () => {
    const schema = z.object({})
    const result = toToolSchema(makeTool(schema))

    expect(result.parameters).toMatchObject({
      type: 'object',
      properties: {},
    })
  })

  it('converts a nested object schema', () => {
    const schema = z.object({
      query: z.string(),
      options: z.object({
        limit: z.number(),
        offset: z.number().optional(),
      }),
    })
    const result = toToolSchema(makeTool(schema))

    expect(result.parameters).toMatchObject({
      type: 'object',
      properties: {
        query: { type: 'string' },
        options: {
          type: 'object',
          properties: {
            limit: { type: 'number' },
            offset: { type: 'number' },
          },
          required: ['limit'],
        },
      },
      required: ['query', 'options'],
    })
  })

  it('includes optional fields without marking them required', () => {
    const schema = z.object({
      name: z.string(),
      tag: z.string().optional(),
    })
    const result = toToolSchema(makeTool(schema))

    const params = result.parameters as Record<string, unknown>
    expect(params['required']).toEqual(['name'])
    expect((params['properties'] as Record<string, unknown>)['tag']).toBeDefined()
  })

  it('preserves tool name and description from entity', () => {
    const schema = z.object({})
    const result = toToolSchema(
      makeTool(schema, { name: 'file-reader', description: 'Reads files from disk' }),
    )

    expect(result.name).toBe('file-reader')
    expect(result.description).toBe('Reads files from disk')
  })
})
