import { extractLastJsonObject } from '../src/utils'

describe('extractLastJsonObject', () => {
  it('extracts single object', () => {
    expect(extractLastJsonObject('{"a":1}')).toBe('{"a":1}')
  })

  it('extracts last object when multiple exist', () => {
    const input = '{"first":1} some text {"last":2}'
    expect(extractLastJsonObject(input)).toBe('{"last":2}')
  })

  it('extracts last object with nested structure', () => {
    const input = 'Preamble {"x":1} Tool result {"commitMessage":"feat: add x","files":[]}'
    const result = extractLastJsonObject(input)
    expect(JSON.parse(result)).toEqual({ commitMessage: 'feat: add x', files: [] })
  })

  it('throws when no object present', () => {
    expect(() => extractLastJsonObject('no brackets')).toThrow(
      'No JSON object found in response',
    )
  })
})
