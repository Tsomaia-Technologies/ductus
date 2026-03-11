import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { PromptTemplate } from '../interfaces/prompt-template.js'
import { SystemAdapter } from '../interfaces/system-adapter.js'
import { FileAdapter } from '../interfaces/file-adapter.js'
import { Injector } from '../interfaces/event-generator.js'
import { identity } from '../utils/common-utils.js'

import { TemplateRenderer } from '../interfaces/template-renderer.js'

export class AgentPromptComposer {
  constructor(
    private readonly templateRenderer: TemplateRenderer,
    private readonly fileAdapter: FileAdapter,
    private readonly systemAdapter: SystemAdapter,
    private readonly injector: Injector,
  ) {}

  async compose(agent: AgentEntity, state: unknown): Promise<string> {
    const parts: string[] = []

    const persona = await this.resolvePersona(agent)
    if (persona) parts.push(persona)

    const systemPrompt = await this.resolveSystemPrompt(agent, state)
    if (systemPrompt) parts.push(systemPrompt)

    return parts.join('\n\n')
  }

  private async formatPrompt<T>(params: {
    prompt: PromptTemplate<T>
    entity: T
    templateContext: Record<string, unknown>
    mapInline?: (inline: string) => string
  }): Promise<string | undefined> {
    let {
      prompt,
      entity,
      templateContext,
      mapInline = identity,
    } = params

    if (typeof prompt === 'function') {
      prompt = await prompt(this.injector, entity)
    }

    if (typeof prompt === 'object' && 'raw' in prompt) {
      return prompt.raw
    }

    let isInline = true

    if (typeof prompt === 'object' && 'template' in prompt) {
      prompt = await this.fileAdapter.read(
        this.systemAdapter.resolveAbsolutePath(prompt.template),
        '',
      )
      isInline = false
    }

    return await this.awaitRendered(
      this.templateRenderer(
        isInline ? mapInline(String(prompt)) : String(prompt),
        templateContext,
      ),
    )
  }

  private async resolvePersona(agent: AgentEntity): Promise<string | undefined> {
    const { persona } = agent

    return await this.formatPrompt({
      prompt: persona,
      entity: agent,
      templateContext: {
        agent,
        rules: agent.rules,
        rulesets: agent.rulesets,
      },
      mapInline: value => {
        const parts = [value]

        if (agent.rules.length > 0) {
          const ruleLines = agent.rules.map(r => `- ${r}`).join('\n')
          parts.push(`\nRules:\n${ruleLines}`)
        }

        for (const ruleset of agent.rulesets) {
          const ruleLines = ruleset.rules.map(r => `- ${r}`).join('\n')
          parts.push(`\n${ruleset.name}:\n${ruleLines}`)
        }

        return parts.join('')
      },
    })
  }

  private async resolveSystemPrompt(agent: AgentEntity, state: unknown): Promise<string | undefined> {
    const { systemPrompt } = agent

    if (!systemPrompt) return undefined

    return await this.formatPrompt({
      prompt: systemPrompt,
      entity: agent,
      templateContext: {
        state,
      },
    })
  }

  private async awaitRendered(result: string | Promise<string>): Promise<string> {
    return result
  }
}
