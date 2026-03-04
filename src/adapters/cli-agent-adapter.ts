import { AgentAdapter } from '../interfaces/entities/adapter-entity.js'
import { AgentContext } from '../interfaces/agent-context.js'
import { AgentChunk } from '../interfaces/agent-chunk.js'
import { NodeSystemAdapter } from '../system/node-system-adapter.js'
import { SystemProcessAdapter } from '../interfaces/system-process-adapter.js'

export interface CliAdapterConfig {
  command: string
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

  constructor(private readonly config: CliAdapterConfig) {
  }

  async initialize(context?: AgentContext): Promise<void> {
    const { command, args, cwd, env, timeoutMs } = this.config

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

    this.processAdapter = this.systemAdapter.spawn(command, args, {
      cwd,
      env: resolvedEnv,
      timeoutMs,
    })
  }

  async* process(input: string): AsyncIterable<AgentChunk> {
    if (!this.processAdapter) {
      throw new Error('Adapter not initialized. Call initialize() first.')
    }

    await this.processAdapter.write(input, { end: true })

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
          yield {
            type: 'complete',
            timestamp: event.timestamp,
          }
          return
      }
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
