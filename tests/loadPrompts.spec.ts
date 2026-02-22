import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { loadPrompts } from '../src/load-prompts'

describe('loadPrompts', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ductus-load-prompts-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('eject behavior', () => {
    it('ejects prompts when .ductus/prompts/<folder> does not exist', () => {
      const result = loadPrompts('architect', { schema: '{}', plan: 'test' }, tempDir)

      const targetDir = path.join(tempDir, '.ductus', 'prompts', 'architect')
      expect(fs.existsSync(targetDir)).toBe(true)
      const mxFiles = fs.readdirSync(targetDir).filter((f) => f.endsWith('.mx'))
      expect(mxFiles.length).toBeGreaterThan(0)
      expect(result.length).toBeGreaterThan(0)
    })

    it('ejects prompts when .ductus/prompts/<folder> exists but is empty', () => {
      const targetDir = path.join(tempDir, '.ductus', 'prompts', 'architect')
      fs.mkdirSync(targetDir, { recursive: true })

      loadPrompts('architect', { schema: '{}', plan: 'test' }, tempDir)

      const mxFiles = fs.readdirSync(targetDir).filter((f) => f.endsWith('.mx'))
      expect(mxFiles.length).toBeGreaterThan(0)
    })

    it('does not eject when target already contains .mx files', () => {
      const targetDir = path.join(tempDir, '.ductus', 'prompts', 'architect')
      fs.mkdirSync(targetDir, { recursive: true })
      const customPath = path.join(targetDir, 'custom.mx')
      fs.writeFileSync(
        customPath,
        '---\nname: custom\n---\nCustom content {{ value }}',
      )

      const result = loadPrompts('architect', { schema: '{}', plan: 'x', value: 'VAL' }, tempDir)

      expect(result.some((r) => r.data.name === 'custom')).toBe(true)
      expect(result.find((r) => r.data.name === 'custom')?.content).toContain('VAL')
    })

    it('throws when neither source nor target has prompts', () => {
      expect(() =>
        loadPrompts('nonexistent-folder-xyz', { schema: '{}', plan: 'x' }, tempDir),
      ).toThrow(/No prompts found/)
    })
  })

  describe('gray-matter output', () => {
    it('returns GrayMatterFile objects with data and content', () => {
      const result = loadPrompts('architect', { schema: '{}', plan: 'plan text' }, tempDir)

      expect(result.length).toBeGreaterThan(0)
      for (const file of result) {
        expect(file).toHaveProperty('data')
        expect(file).toHaveProperty('content')
        expect(typeof file.data).toBe('object')
        expect(typeof file.content).toBe('string')
      }
    })

    it('parses YAML frontmatter correctly', () => {
      const result = loadPrompts('architect', { schema: '{}', plan: 'x' }, tempDir)
      const defaultPrompt = result.find((r) => r.data.name === 'architect')

      expect(defaultPrompt).toBeDefined()
      expect(defaultPrompt?.data.name).toBe('architect')
      expect(defaultPrompt?.data.model).toBe('auto')
    })

    it('renders Moxite templates with context', () => {
      const result = loadPrompts('architect', {
        schema: '{"type":"array"}',
        plan: 'Build auth',
      }, tempDir)

      const defaultPrompt = result.find((r) => r.data.name === 'architect')
      expect(defaultPrompt?.content).toContain('{"type":"array"}')
      expect(defaultPrompt?.content).toContain('Build auth')
    })
  })

  describe('nested .mx files', () => {
    it('finds .mx files in subdirectories', () => {
      const result = loadPrompts('planner', { schema: '{}', plan: 'x' }, tempDir)

      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('cwd parameter', () => {
    it('loads from provided cwd', () => {
      const result = loadPrompts('architect', { schema: '{}', plan: 'x' }, tempDir)
      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
