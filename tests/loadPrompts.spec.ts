import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { loadPrompts, ejectPrompts } from '../src/load-prompts'

describe('ejectPrompts', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ductus-eject-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('ejects prompts when target does not exist', () => {
    ejectPrompts(tempDir)

    const targetDir = path.join(tempDir, '.ductus', 'prompts')
    expect(fs.existsSync(targetDir)).toBe(true)
    const architectDir = path.join(targetDir, 'architect')
    expect(fs.existsSync(architectDir)).toBe(true)
    const mxFiles = fs.readdirSync(architectDir).filter((f) => f.endsWith('.mx'))
    expect(mxFiles.length).toBeGreaterThan(0)
  })

  it('ejects prompts when target exists but is empty', () => {
    const targetDir = path.join(tempDir, '.ductus', 'prompts', 'architect')
    fs.mkdirSync(targetDir, { recursive: true })

    ejectPrompts(tempDir)

    const mxFiles = fs.readdirSync(targetDir).filter((f) => f.endsWith('.mx'))
    expect(mxFiles.length).toBeGreaterThan(0)
  })

  it('does not overwrite when target already contains .mx files', () => {
    ejectPrompts(tempDir)
    const targetDir = path.join(tempDir, '.ductus', 'prompts', 'architect')
    const customPath = path.join(targetDir, 'custom.mx')
    fs.writeFileSync(
      customPath,
      '---\nname: custom\n---\nCustom content {{ value }}',
    )

    ejectPrompts(tempDir)

    expect(fs.existsSync(customPath)).toBe(true)
    expect(fs.readFileSync(customPath, 'utf-8')).toContain('Custom content')
  })

  it('overwrites when --overwrite is true', () => {
    ejectPrompts(tempDir)
    const targetDir = path.join(tempDir, '.ductus', 'prompts', 'architect')
    const customPath = path.join(targetDir, 'custom.mx')
    fs.writeFileSync(customPath, 'custom content to be replaced')

    ejectPrompts(tempDir, { overwrite: true })

    expect(fs.existsSync(customPath)).toBe(false)
  })
})

describe('loadPrompts', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ductus-load-prompts-'))
    ejectPrompts(tempDir)
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('throws when prompts folder does not exist', () => {
    expect(() =>
      loadPrompts('nonexistent-folder-xyz', { schema: '{}', plan: 'x' }, tempDir),
    ).toThrow(/No prompts found/)
  })

  it('throws with hint to run ductus eject', () => {
    const anotherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ductus-empty-'))
    try {
      expect(() =>
        loadPrompts('architect', { schema: '{}', plan: 'x' }, anotherDir),
      ).toThrow(/ductus eject/)
    } finally {
      fs.rmSync(anotherDir, { recursive: true, force: true })
    }
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
      const result = loadPrompts('architect', { schema: '{}', plan: 'x' }, tempDir)

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

  describe('custom prompts', () => {
    it('uses custom prompt when target has .mx files', () => {
      const targetDir = path.join(tempDir, '.ductus', 'prompts', 'architect')
      const customPath = path.join(targetDir, 'custom.mx')
      fs.writeFileSync(
        customPath,
        '---\nname: custom\n---\nCustom content {{ value }}',
      )

      const result = loadPrompts('architect', { schema: '{}', plan: 'x', value: 'VAL' }, tempDir)

      expect(result.some((r) => r.data.name === 'custom')).toBe(true)
      expect(result.find((r) => r.data.name === 'custom')?.content).toContain('VAL')
    })
  })
})
