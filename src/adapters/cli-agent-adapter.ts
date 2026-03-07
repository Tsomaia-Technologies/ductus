import { AgentAdapter } from '../interfaces/entities/adapter-entity.js'
import { AgentContext } from '../interfaces/agent-context.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { NodeSystemAdapter } from '../system/node-system-adapter.js'
import { SystemProcessAdapter } from '../interfaces/system-process-adapter.js'
import { InvocationContext } from '../core/pipeline/agent-interceptor.js'
import { DynamicCommand } from '../interfaces/builders/cli-adapter-builder.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'

export interface CliAdapterParams {
  agent: AgentEntity
  model: ModelEntity
  command: string | DynamicCommand
  args: string[]
  cwd: string
  env: Record<string, string | undefined>
  timeoutMs?: number
}

/**
 * Runtime CLI adapter — spawns a child process and communicates via stdin/stdout.
 * Created by DefaultCliAdapterBuilder's factory closure.
 */
export class CliAgentAdapter implements AgentAdapter {
  private processAdapter: SystemProcessAdapter | null = null
  private systemAdapter: NodeSystemAdapter | null = null

  constructor(private readonly params: CliAdapterParams) {
  }

  async initialize(context?: AgentContext): Promise<void> {
    const { model, command, args, cwd, env, timeoutMs } = this.params

    const resolvedEnv: Record<string, string> = Object.fromEntries(
      Object.entries(env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    )

    if (context) {
      resolvedEnv.DUCTUS_CONTEXT = JSON.stringify(context)
    }

    this.systemAdapter = new NodeSystemAdapter({
      defaultCwd: cwd,
      defaultEnv: resolvedEnv,
    })

    const cmd = typeof command === 'function' ? command(model) : command
    this.processAdapter = this.systemAdapter.spawn(cmd, args, {
      cwd,
      env: resolvedEnv,
      timeoutMs,
    })
  }

  async* process(context: InvocationContext): AsyncIterable<AgentChunk> {
    if (!this.processAdapter) {
      throw new Error('Adapter not initialized. Call initialize() first.')
    }

    if (!context.prompt) {
      throw new Error('No prompt in context for adapter execution.')
    }

    await this.processAdapter.write(context.prompt, { end: true })

    for await (const event of this.processAdapter.readStream()) {
      switch (event.type) {
        case 'stdout':
          yield {
            type: 'text',
            content: event.content,
            timestamp: event.timestamp,
          }
          break

        case 'stderr':
          yield {
            type: 'error',
            reason: event.content,
            timestamp: event.timestamp,
          }
          break

        case 'exit':
          if (event.exitCode !== 0) {
            yield {
              type: 'error',
              reason: `Process exited with code ${event.exitCode}${event.signal ? ` (signal: ${event.signal})` : ''}`,
              timestamp: event.timestamp,
            }
          }
          yield {
            type: 'complete',
            timestamp: event.timestamp,
          }
          return
      }
    }
  }

  parse(chunks: AgentChunk[]): any {
    const text = chunks
      .filter(c => c.type === 'text')
      .map(c => (c as any).content)
      .join('')

    const match = text.match(/[\[{][\s\S]*[\]}]/)
    if (!match) {
      throw new Error(`Failed to extract JSON from agent response. Raw text length: ${text.length}`)
    }

    try {
      return JSON.parse(match[0])
    } catch (e) {
      throw new Error(`Failed to parse extracted JSON block: ${(e as Error).message}`)
    }
  }

  async terminate(): Promise<void> {
    if (this.processAdapter) {
      await this.processAdapter.gracefullyShutdown({ drain: true })
      this.processAdapter = null
    }
    if (this.systemAdapter) {
      await this.systemAdapter.terminate()
      this.systemAdapter = null
    }
  }
}
