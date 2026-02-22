import { extractJsonArray } from '../src/utils'

describe('extractJsonArray', () => {
  describe('clean JSON only', () => {
    it('extracts empty array', () => {
      expect(extractJsonArray('[]')).toBe('[]')
    })

    it('extracts simple primitive array', () => {
      expect(extractJsonArray('[1, 2, 3]')).toBe('[1, 2, 3]')
    })

    it('extracts array of objects', () => {
      const input = '[{"a":1},{"b":2}]'
      expect(extractJsonArray(input)).toBe(input)
    })

    it('extracts nested objects inside array', () => {
      const input = '[{"nested":{"a":[1,2]}}]'
      expect(extractJsonArray(input)).toBe(input)
    })

    it('extracts deeply nested array', () => {
      const input = '[[[1]]]'
      expect(extractJsonArray(input)).toBe(input)
    })

    it('extracts array with mixed types', () => {
      const input = '[1, "two", true, null, {"key": "value"}]'
      expect(extractJsonArray(input)).toBe(input)
    })

    it('extracts array with empty strings', () => {
      const input = '["", ""]'
      expect(extractJsonArray(input)).toBe(input)
    })

    it('extracts array with unicode', () => {
      const input = '[{"name": "José", "emoji": "🚀"}]'
      expect(extractJsonArray(input)).toBe(input)
    })
  })

  describe('markdown code fences', () => {
    it('strips ```json fence', () => {
      const input = '```json\n[1, 2, 3]\n```'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('strips ``` fence without json tag', () => {
      const input = '```\n[1, 2, 3]\n```'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('handles ```JSON (uppercase)', () => {
      const input = '```JSON\n[1, 2, 3]\n```'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('handles Json (mixed case)', () => {
      const input = '```Json\n[1, 2, 3]\n```'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('handles fence with extra whitespace before newline', () => {
      const input = '```json   \n[1, 2, 3]\n```'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('handles closing fence with trailing whitespace', () => {
      const input = '[1, 2, 3]\n```   '
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('handles fence with array of objects', () => {
      const input = '```json\n[{"id":"a","x":1}]\n```'
      expect(extractJsonArray(input)).toBe('[{"id":"a","x":1}]')
    })
  })

  describe('preamble text', () => {
    it('extracts array after simple preamble', () => {
      const input = 'Here is the JSON: [1, 2, 3]'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('extracts array after conversational preamble', () => {
      const input = 'Sure, here you go: [1, 2, 3]'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('extracts array after multi-line preamble', () => {
      const input = 'I have analyzed the plan.\n\nHere is the breakdown:\n[1, 2, 3]'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('extracts array when first [ appears after much text', () => {
      const input = 'Understood. Let me break this down into tasks. [{"id":"task-1"}]'
      expect(extractJsonArray(input)).toBe('[{"id":"task-1"}]')
    })
  })

  describe('trailing text', () => {
    it('extracts array before trailing text', () => {
      const input = '[1, 2, 3] Let me know if you need changes.'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('extracts array before multi-line trailing text', () => {
      const input = '[1, 2, 3]\n\nHope this helps!'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('extracts array before trailing with brackets in text', () => {
      const input = '[1, 2, 3] See [1] for reference.'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })
  })

  describe('both preamble and trailing text', () => {
    it('extracts array with text on both sides', () => {
      const input = 'Sure: [1, 2, 3] Thanks!'
      expect(extractJsonArray(input)).toBe('[1, 2, 3]')
    })

    it('extracts array with full LLM-style response', () => {
      const input = "I've analyzed the plan. Here are the tasks:\n[{\"id\":\"a\"}]\n\nLet me know if you want adjustments."
      expect(extractJsonArray(input)).toBe('[{"id":"a"}]')
    })
  })

  describe('brackets inside strings', () => {
    it('extracts correctly when string contains closing bracket', () => {
      const input = '[{"desc": "value with ] bracket"}]'
      expect(extractJsonArray(input)).toBe(input)
    })

    it('extracts correctly when string contains opening bracket', () => {
      const input = '[{"key": "open [ bracket"}]'
      expect(extractJsonArray(input)).toBe(input)
    })

    it('extracts correctly when string contains both brackets', () => {
      const input = '[{"text": "both [ and ] here"}]'
      expect(extractJsonArray(input)).toBe(input)
    })

    it('extracts correctly with escaped quotes in string', () => {
      const input = '[{"key": "value with \\" escaped"}]'
      expect(extractJsonArray(input)).toBe(input)
    })

    it('extracts correctly with escaped backslash before quote', () => {
      const input = '[{"key": "backslash\\\\quote"}]'
      expect(extractJsonArray(input)).toBe(input)
    })

    it('extracts correctly with nested objects whose values have brackets', () => {
      const input = '[{"a":{"b":"] ["}}]'
      expect(extractJsonArray(input)).toBe(input)
    })
  })

  describe('whitespace', () => {
    it('trims leading whitespace', () => {
      expect(extractJsonArray('   \n  [1, 2, 3]')).toBe('[1, 2, 3]')
    })

    it('trims trailing whitespace', () => {
      expect(extractJsonArray('[1, 2, 3]   \n  ')).toBe('[1, 2, 3]')
    })

    it('preserves whitespace inside the array', () => {
      const input = '[ 1 , 2 , 3 ]'
      expect(extractJsonArray(input)).toBe(input)
    })
  })

  describe('multiple arrays (extracts first complete one)', () => {
    it('extracts first array when two arrays exist', () => {
      const input = 'First: [1, 2] Second: [3, 4]'
      expect(extractJsonArray(input)).toBe('[1, 2]')
    })

    it('extracts first array when nested second array exists', () => {
      const input = '[["inner"], "extra"]'
      expect(extractJsonArray(input)).toBe('[["inner"], "extra"]')
    })
  })

  describe('error cases', () => {
    it('throws when no array present - plain text', () => {
      expect(() => extractJsonArray('just some text')).toThrow(
        'No JSON array found in Architect response',
      )
    })

    it('throws when no array present - empty string', () => {
      expect(() => extractJsonArray('')).toThrow(
        'No JSON array found in Architect response',
      )
    })

    it('throws when no array present - only whitespace', () => {
      expect(() => extractJsonArray('   \n\t  ')).toThrow(
        'No JSON array found in Architect response',
      )
    })

    it('throws when unmatched opening bracket - no closing', () => {
      expect(() => extractJsonArray('[1, 2, 3')).toThrow(
        'No complete JSON array found in Architect response (unmatched brackets)',
      )
    })

    it('extracts array and ignores extra trailing bracket (returns first valid array)', () => {
      expect(extractJsonArray('[1, 2, 3]]')).toBe('[1, 2, 3]')
    })

    it('throws when mismatched brackets - object not closed', () => {
      expect(() => extractJsonArray('[{"a": 1]')).toThrow(
        'No complete JSON array found in Architect response (unmatched brackets)',
      )
    })

    it('throws when only closing bracket', () => {
      expect(() => extractJsonArray(']')).toThrow(
        'No JSON array found in Architect response',
      )
    })

    it('throws when bracket is inside unfinished string', () => {
      // "[..." - we find first [, then we're in an unclosed string, never get valid ]
      expect(() => extractJsonArray('["unclosed string')).toThrow(
        'No complete JSON array found in Architect response (unmatched brackets)',
      )
    })

    it('extracts inline array [1] from prose (first [ starts valid array)', () => {
      expect(extractJsonArray('See [1] for ref - no other array')).toBe('[1]')
    })

    it('throws when [ has no matching ] in prose', () => {
      expect(() => extractJsonArray('Unmatched [ open bracket only')).toThrow(
        'No complete JSON array found in Architect response (unmatched brackets)',
      )
    })
  })

  describe('realistic Architect-style outputs', () => {
    it('handles typical LLM preamble with markdown', () => {
      const input = `I've analyzed the plan. Here are the tasks:

\`\`\`json
[
  {"id": "db-setup", "summary": "Set up database schema"},
  {"id": "auth-api", "summary": "Implement auth endpoints"}
]
\`\`\`

Let me know if you need any adjustments.`
      const result = extractJsonArray(input)
      expect(JSON.parse(result)).toEqual([
        { id: 'db-setup', summary: 'Set up database schema' },
        { id: 'auth-api', summary: 'Implement auth endpoints' },
      ])
    })

    it('handles minimal accidental preamble', () => {
      const input = 'Sure!\n[{"id":"x"}]'
      expect(extractJsonArray(input)).toBe('[{"id":"x"}]')
    })

    it('handles response with task-like structure', () => {
      const input = `[
  {
    "id": "task-1",
    "summary": "Create database migrations",
    "description": "Add User and Session tables",
    "objective": "Enable persistent auth storage",
    "requirements": ["Use Prisma", "Add indexes"],
    "constraints": ["PostgreSQL only"]
  }
]`
      const result = extractJsonArray(input)
      expect(result).toContain('"id": "task-1"')
      expect(JSON.parse(result)).toHaveLength(1)
    })
  })
})
