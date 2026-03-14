import { ImmutableAgentBuilder } from './builders/immutable-agent-builder.js'
import { ImmutableSkillBuilder } from './builders/immutable-skill-builder.js'
import { ImmutableProcessorBuilder } from './builders/immutable-processor-builder.js'
import { EventGenerator, Injector } from './interfaces/event-generator.js'
import { ImmutableReactionBuilder } from './builders/immutable-reaction-builder.js'
import { ImmutableReducerBuilder } from './builders/immutable-reducer-builder.js'
import { ImmutableFlowBuilder } from './builders/immutable-flow-builder.js'
import { ImmutableModelBuilder } from './builders/immutable-model-builder.js'
import { ImmutableToolBuilder } from './builders/immutable-tool-builder.js'
import { FlowEntity } from './interfaces/entities/flow-entity.js'
import { EventDefinition } from './interfaces/event.js'
import { DuctusKernel } from './core/ductus-kernel.js'
import { ImmutableRulesetBuilder } from './builders/immutable-ruleset-builder.js'
import { AgentDispatcher } from './core/agent-dispatcher.js'
import type { TemplateRenderer } from './interfaces/template-renderer.js'
import { DuctusStore } from './core/ductus-store.js'
import { createReactionAdapter } from './utils/internals.js'
import { AgentBuilder } from './interfaces/builders/agent-builder.js'
import { FlowBuilder } from './interfaces/builders/flow-builder.js'
import { ModelBuilder } from './interfaces/builders/model-builder.js'
import { EmitBuildStep, InvokeBuildStep, ReactionBuilder } from './interfaces/builders/reaction-builder.js'
import { ReducerBuilder } from './interfaces/builders/reducer-builder.js'
import { RulesetBuilder } from './interfaces/builders/ruleset-builder.js'
import { SkillBuilder } from './interfaces/builders/skill-builder.js'
import { ProcessorBuilder } from './interfaces/builders/processor-builder.js'
import { ToolBuilder } from './interfaces/builders/tool-builder.js'
import { Multiplexer } from './interfaces/multiplexer.js'
import { EventLedger } from './interfaces/event-ledger.js'
import { CancellationToken } from './interfaces/cancellation-token.js'
import { SystemAdapter } from './interfaces/system-adapter.js'
import { FileAdapter } from './interfaces/file-adapter.js'
import { AsyncEntity } from './interfaces/entities/async-entity.js'
import { build } from './interfaces/builders/__internal__.js'
import { ContainerBuilder } from './interfaces/builders/container-builder.js'
import { ImmutableContainerBuilder } from './builders/immutable-container-builder.js'
import { event, signal } from './utils/event-utils.js'
import {
  _enum,
  _null,
  array,
  boolean,
  date,
  discriminatedUnion,
  literal,
  nullable,
  number,
  object,
  string,
  union,
} from './utils/schema-utils.js'
import { BootEvent } from './core/events.js'
import { observationEvents } from './events/observation-events.js'
import { EventSequencer } from './interfaces/event-sequencer.js'
import { ImmutableFixedClusterBuilder } from './builders/immutable-fixed-cluster-builder.js'
import { ImmutableDynamicClusterBuilder } from './builders/immutable-dynamic-cluster-builder.js'
import { DynamicClusterBuilder } from './interfaces/builders/dynamic-cluster-builder.js'
import { FixedClusterBuilder } from './interfaces/builders/fixed-cluster-builder.js'
import { ConcurrentProcessorBuilder } from './interfaces/builders/concurrent-processor-builder.js'
import { ImmutableConcurrentProcessorBuilder } from './builders/immutable-concurrent-processor-builder.js'

export interface CreateKernelOptions<TState> {
  flow: FlowBuilder<TState>
  multiplexer: Multiplexer
  sequencer: EventSequencer
  ledger: EventLedger
  container: ContainerBuilder
  templateRenderer: TemplateRenderer
  systemAdapter: SystemAdapter
  fileAdapter: FileAdapter
  canceller?: CancellationToken
}

function agent(name: string): AgentBuilder {
  return new ImmutableAgentBuilder().name(name)
}

function flow<TState>(): FlowBuilder<TState> {
  return new ImmutableFlowBuilder<TState>()
}

function model(modelId: string): ModelBuilder {
  return new ImmutableModelBuilder().model(modelId)
}

function reaction(name: string): ReactionBuilder {
  return new ImmutableReactionBuilder().name(name)
}

function reducer<TState>(): ReducerBuilder<TState> {
  return new ImmutableReducerBuilder<TState>()
}

function ruleset(name: string): RulesetBuilder {
  return new ImmutableRulesetBuilder().name(name)
}

function skill(name: string): SkillBuilder {
  return new ImmutableSkillBuilder().name(name)
}

function processor<TState>(generator: EventGenerator<TState>): ProcessorBuilder<TState>
function processor<TState>(name: string, generator: EventGenerator<TState>): ProcessorBuilder<TState>
function processor<TState>(
  generatorOrName: string | EventGenerator<TState>,
  generator?: EventGenerator<TState>,
): ProcessorBuilder<TState> {
  const gen = typeof generatorOrName !== 'string' ? generatorOrName : generator
  const name = typeof generatorOrName === 'string'
    ? generatorOrName
    : gen?.name ?? null

  if (!gen) {
    throw new Error('Processor requires a generator function.')
  }

  return new ImmutableProcessorBuilder<TState>()
    .name(name)
    .processor(gen)
}

function tool(name: string): ToolBuilder {
  return new ImmutableToolBuilder().name(name)
}

function async<TState>(
  factory: (use: Injector) => Promise<FlowEntity<TState>>,
): AsyncEntity<TState> {
  return {
    factory,
  }
}

function emit(event: EventDefinition): EmitBuildStep {
  return {
    type: 'emit',
    event,
  }
}

function invoke(agent: AgentBuilder, skill: SkillBuilder): InvokeBuildStep {
  return {
    type: 'invoke',
    agent,
    skill,
  }
}

function container(): ContainerBuilder {
  return new ImmutableContainerBuilder()
}

function fixedCluster<TState>(name?: string | null): FixedClusterBuilder<TState> {
  return new ImmutableFixedClusterBuilder<TState>()
    .name(name ?? null)
}

function dynamicCluster<TState>(name?: string | null): DynamicClusterBuilder<TState> {
  return new ImmutableDynamicClusterBuilder<TState>()
    .name(name ?? null)
}

function concurrent<TState>(name?: string | null): ConcurrentProcessorBuilder<TState> {
  return new ImmutableConcurrentProcessorBuilder<TState>()
    .name(name ?? null)
}

export function kernel<TState>(
  options: CreateKernelOptions<TState>,
) {
  const {
    multiplexer,
    sequencer,
    ledger,
    container: containerBuilder,
    canceller,
    templateRenderer,
    systemAdapter,
    fileAdapter,
  } = options

  const flow = build(options.flow)

  const store = new DuctusStore(
    flow.initialState,
    flow.reducer.reducer,
  )

  const coreContainer = container()
    .parent(containerBuilder)
    .token(SystemAdapter, systemAdapter)
    .token(FileAdapter, fileAdapter)

  const { use } = build(coreContainer)

  const agentTuples = flow.agents
    .filter(a => a.transport !== undefined || a.agent.defaultTransport !== undefined)
    .map(a => ({
      agent: a.agent,
      model: a.model,
      transport: a.transport,
    }))

  const dispatcher = new AgentDispatcher({
    agents: agentTuples,
    store,
    templateRenderer,
    injector: use,
    systemAdapter,
    fileAdapter,
  })

  const reactionProcessors = flow.reactions.map(entity => {
    return createReactionAdapter(entity, dispatcher)
  })

  return new DuctusKernel({
    multiplexer,
    sequencer,
    processors: [...flow.processors, ...reactionProcessors],
    ledger,
    store,
    injector: use,
    canceller,
    onShutdown: () => dispatcher.terminateAll(),
  })
}

/**
 * Built-in transport implementations.
 * Currently empty — implement AgentTransport directly.
 * Built-in transports (Anthropic, OpenAI, etc.) are future work.
 * @see AgentTransport interface for the transport contract.
 */
const transport = {} as Record<string, unknown>

export default {
  BootEvent,

  event,
  signal,

  agent,
  flow,
  model,
  reaction,
  reducer,
  ruleset,
  skill,
  processor,
  tool,
  async,

  emit,
  invoke,

  container,

  fixedCluster,
  dynamicCluster,
  concurrent,

  kernel,

  transport,

  events: observationEvents,

  literal,
  boolean,
  string,
  number,
  null: _null,
  nullable,
  date,
  union,
  discriminatedUnion,
  object,
  array,
  enum: _enum,
}
