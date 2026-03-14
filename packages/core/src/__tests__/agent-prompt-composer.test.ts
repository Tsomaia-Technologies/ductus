import { AgentPromptComposer } from '../core/agent-prompt-composer.js'
import { TemplateRenderer } from '../interfaces/template-renderer.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { Injector } from '../interfaces/event-generator.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { FileAdapter } from '../interfaces/file-adapter.js'

const noopRenderer: TemplateRenderer = (t) => t
const mockUse = (() => undefined) as unknown as Injector

function stubSystemAdapter(): SystemAdapter {
  return {
    getDefaultEnv: () => ({}),
    getDefaultCwd: () => '/tmp',
    getDefaultMaxBuffer: () => 1024,
    resolveAbsolutePath: (...segs: string[]) => segs.join('/'),
    execute: async () => ({ stdout: '', stderr: '', exitCode: 0, timedOut: false, cancelled: false }),
    spawn: () => { throw new Error('not implemented') },
    terminate: async () => {},
    prompt: async () => '',
  }
}

function stubFileAdapter(files?: Record<string, string>): FileAdapter {
  return {
    exists: async () => false,
    read: async (p: string, fallback?: string | null) => files?.[p] ?? fallback ?? null,
    readJson: async () => null,
    readLines: async function* () {},
    readLinesJsonl: async function* () {},
    readLastLineJsonl: async () => null,
    write: async () => true,
    writeJson: async () => true,
    append: async () => {},
    appendLine: async () => {},
    appendLineJsonl: async () => {},
    createDirectory: async () => true,
    createDirectoryRecursive: async () => {},
    delete: async () => true,
    open: async () => { throw new Error('not implemented') },
  } as FileAdapter
}

function buildAgent(overrides?: Partial<AgentEntity>): AgentEntity {
  return {
    name: 'test-agent',
    role: 'tester',
    persona: 'You are a test agent.',
    skill: [],
    rules: [],
    rulesets: [],
    ...overrides,
  } as AgentEntity
}

describe('AgentPromptComposer', () => {
  it('composes system message from string persona', async () => {
    const composer = new AgentPromptComposer(noopRenderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    const result = await composer.compose(buildAgent(), {})
    expect(result).toBe('You are a test agent.')
  })

  it('includes rules in persona when inline', async () => {
    const composer = new AgentPromptComposer(noopRenderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    const result = await composer.compose(
      buildAgent({ rules: ['Be concise', 'Be accurate'] }),
      {},
    )
    expect(result).toContain('You are a test agent.')
    expect(result).toContain('Rules:')
    expect(result).toContain('- Be concise')
    expect(result).toContain('- Be accurate')
  })

  it('includes rulesets in persona when inline', async () => {
    const composer = new AgentPromptComposer(noopRenderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    const result = await composer.compose(
      buildAgent({ rulesets: [{ name: 'Safety', rules: ['Do not harm'] }] }),
      {},
    )
    expect(result).toContain('Safety:')
    expect(result).toContain('- Do not harm')
  })

  it('combines persona and systemPrompt with double newline', async () => {
    const composer = new AgentPromptComposer(noopRenderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    const result = await composer.compose(
      buildAgent({ systemPrompt: 'Additional instructions here.' }),
      {},
    )
    expect(result).toBe('You are a test agent.\n\nAdditional instructions here.')
  })

  it('passes state to template renderer for systemPrompt', async () => {
    let capturedContext: Record<string, unknown> = {}
    const renderer: TemplateRenderer = (t, ctx) => {
      capturedContext = ctx
      return t
    }
    const composer = new AgentPromptComposer(renderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    await composer.compose(buildAgent({ systemPrompt: 'Count is {{count}}' }), { count: 42 })
    expect(capturedContext.state).toEqual({ count: 42 })
  })

  it('does not hold a store reference', () => {
    const composer = new AgentPromptComposer(noopRenderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    expect((composer as unknown as Record<string, unknown>).store).toBeUndefined()
    expect((composer as unknown as Record<string, unknown>).state).toBeUndefined()
  })

  it('handles raw prompt format for persona', async () => {
    const composer = new AgentPromptComposer(noopRenderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    const result = await composer.compose(
      buildAgent({ persona: { raw: 'Raw persona text' } }),
      {},
    )
    expect(result).toBe('Raw persona text')
  })

  it('handles async template resolver for persona', async () => {
    const composer = new AgentPromptComposer(noopRenderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    const result = await composer.compose(
      buildAgent({ persona: async () => 'Async persona' }),
      {},
    )
    expect(result).toBe('Async persona')
  })

  it('handles file template for persona', async () => {
    const files: Record<string, string> = { 'persona.txt': 'File-based persona' }
    const composer = new AgentPromptComposer(noopRenderer, stubFileAdapter(files), stubSystemAdapter(), mockUse)
    const result = await composer.compose(
      buildAgent({ persona: { template: 'persona.txt' } }),
      {},
    )
    expect(result).toBe('File-based persona')
  })

  it('returns empty string when persona produces nothing and no systemPrompt', async () => {
    const composer = new AgentPromptComposer(noopRenderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    const result = await composer.compose(
      buildAgent({ persona: { raw: '' } }),
      {},
    )
    expect(result).toBe('')
  })

  it('handles raw systemPrompt', async () => {
    const composer = new AgentPromptComposer(noopRenderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    const result = await composer.compose(
      buildAgent({ persona: 'Persona.', systemPrompt: { raw: 'Raw system prompt.' } }),
      {},
    )
    expect(result).toBe('Persona.\n\nRaw system prompt.')
  })

  it('uses template renderer for inline persona', async () => {
    const renderer: TemplateRenderer = (t, ctx) => t.replace('{{name}}', String((ctx.agent as Record<string, unknown>)?.name ?? ''))
    const composer = new AgentPromptComposer(renderer, stubFileAdapter(), stubSystemAdapter(), mockUse)
    const result = await composer.compose(
      buildAgent({ name: 'Alpha', persona: 'I am {{name}}.' }),
      {},
    )
    expect(result).toBe('I am Alpha.')
  })
})
