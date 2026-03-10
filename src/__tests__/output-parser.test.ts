import { parseAgentOutput } from '../core/output-parser.js'
import { z } from 'zod/v3'
import { AgentChunk } from '../interfaces/agent-chunk.js'

const schema = z.object({ code: z.string(), files: z.array(z.string()) })

const text = (content: string): AgentChunk => ({ type: 'text', content, timestamp: Date.now() })
const data = (d: unknown): AgentChunk => ({ type: 'data', data: d, timestamp: Date.now() })
const complete = (): AgentChunk => ({ type: 'complete', timestamp: Date.now() })

describe('parseAgentOutput', () => {
  it('pure JSON response parses correctly', () => {
    const chunks = [text('{"code": "x", "files": ["a.ts"]}'), complete()]
    const result = parseAgentOutput(chunks, schema)
    expect(result).toEqual({ code: 'x', files: ['a.ts'] })
  })

  it('JSON in markdown block extracts and parses', () => {
    const chunks = [
      text('Here is the result:\n```json\n{"code": "x", "files": ["b.ts"]}\n```'),
      complete(),
    ]
    const result = parseAgentOutput(chunks, schema)
    expect(result).toEqual({ code: 'x', files: ['b.ts'] })
  })

  it('mixed text with JSON extracts JSON portion', () => {
    const chunks = [
      text('I will implement this. '),
      text('{"code": "x", "files": []}'),
      complete(),
    ]
    const result = parseAgentOutput(chunks, schema)
    expect(result).toEqual({ code: 'x', files: [] })
  })

  it('data chunk shortcut uses data directly', () => {
    const chunks = [data({ code: 'x', files: [] }), complete()]
    const result = parseAgentOutput(chunks, schema)
    expect(result).toEqual({ code: 'x', files: [] })
  })

  it('no output throws "no output" error', () => {
    const chunks = [complete()]
    expect(() => parseAgentOutput(chunks, schema)).toThrow('Agent produced no output')
  })

  it('invalid JSON throws extraction error', () => {
    const chunks = [text('This is not JSON at all'), complete()]
    expect(() => parseAgentOutput(chunks, schema)).toThrow(
      'Failed to extract JSON from agent response',
    )
  })

  it('schema validation failure throws Zod error', () => {
    const chunks = [text('{"wrong": "shape"}'), complete()]
    expect(() => parseAgentOutput(chunks, schema)).toThrow(z.ZodError)
  })

  it('multiple text chunks concatenated produce valid JSON', () => {
    const chunks = [text('{"co'), text('de": "x", "files": ["c.ts"]}'), complete()]
    const result = parseAgentOutput(chunks, schema)
    expect(result).toEqual({ code: 'x', files: ['c.ts'] })
  })

  it('data chunk takes priority when both data and text chunks exist', () => {
    const chunks = [
      text('{"code": "from-text", "files": []}'),
      data({ code: 'from-data', files: ['d.ts'] }),
      complete(),
    ]
    const result = parseAgentOutput(chunks, schema)
    expect(result).toEqual({ code: 'from-data', files: ['d.ts'] })
  })
})
