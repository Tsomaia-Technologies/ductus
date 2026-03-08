import { ImmutableAgentBuilder } from './builders/immutable-agent-builder.js'
import { ImmutableSkillBuilder } from './builders/immutable-skill-builder.js'
import { ImmutableProcessorBuilder } from './builders/immutable-processor-builder.js'
import { EventGenerator, Injector } from './interfaces/event-generator.js'
import { ImmutableReactionBuilder } from './builders/immutable-reaction-builder.js'
import { ImmutableReducerBuilder } from './builders/immutable-reducer-builder.js'
import { ImmutableFlowBuilder } from './builders/immutable-flow-builder.js'
import { ImmutableModelBuilder } from './builders/immutable-model-builder.js'
import { ImmutableCliAdapterBuilder } from './builders/immutable-cli-adapter-builder.js'
import { FlowEntity } from './interfaces/entities/flow-entity.js'
import { EmitStep, InvokeStep } from './interfaces/entities/reaction-entity.js'
import { EventDefinition } from './interfaces/event.js'
import { DuctusKernel } from './core/ductus-kernel.js'
import { ImmutableRulesetBuilder } from './builders/immutable-ruleset-builder.js'
import { AgentDispatcher, TemplateRenderer } from './core/agent-dispatcher.js'
import { DuctusStore } from './core/ductus-store.js'
import { createReactionAdapter } from './utils/internals.js'
import { AgentBuilder } from './interfaces/builders/agent-builder.js'
import { FlowBuilder } from './interfaces/builders/flow-builder.js'
import { ModelBuilder } from './interfaces/builders/model-builder.js'
import { ReactionBuilder } from './interfaces/builders/reaction-builder.js'
import { ReducerBuilder } from './interfaces/builders/reducer-builder.js'
import { RulesetBuilder } from './interfaces/builders/ruleset-builder.js'
import { SkillBuilder } from './interfaces/builders/skill-builder.js'
import { ProcessorBuilder } from './interfaces/builders/processor-builder.js'
import { Multiplexer } from './interfaces/multiplexer.js'
import { EventLedger } from './interfaces/event-ledger.js'
import { CancellationToken } from './interfaces/cancellation-token.js'
import { SystemAdapter } from './interfaces/system-adapter.js'
import { FileAdapter } from './interfaces/file-adapter.js'
import { AsyncEntity } from './interfaces/entities/async-entity.js'
import { build } from './interfaces/builders/__internal__.js'
import { ContainerBuilder } from './interfaces/builders/container-builder.js'
import { ImmutableContainerBuilder } from './builders/immutable-container-builder.js'
import { CliAdapterBuilder } from './interfaces/builders/cli-adapter-builder.js'
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

export interface CreateKernelOptions<TState> {
  flow: FlowBuilder<TState>
  multiplexer: Multiplexer
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
  const name = typeof generatorOrName === 'string'
    ? generatorOrName
    : generator?.name ?? null
  const gen = typeof generatorOrName !== 'string' ? generatorOrName : generator

  if (!gen) {
    throw new Error('Processor requires a generator function.')
  }

  return new ImmutableProcessorBuilder<TState>()
    .name(name)
    .processor(gen)
}

function adapter(type: 'cli'): CliAdapterBuilder {
  return new ImmutableCliAdapterBuilder()
}

function async<TState>(
  factory: (use: Injector) => Promise<FlowEntity<TState>>,
): AsyncEntity<TState> {
  return {
    factory,
  }
}

function emit(event: EventDefinition): EmitStep {
  return {
    type: 'emit',
    event,
  }
}

function invoke(agent: string, skill: string): InvokeStep {
  return {
    type: 'invoke',
    agent,
    skill,
  }
}

function container(): ContainerBuilder {
  return new ImmutableContainerBuilder()
}

export function kernel<TState>(
  options: CreateKernelOptions<TState>,
) {
  const {
    multiplexer,
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
  const dispatcher = new AgentDispatcher({
    agents: flow.agents,
    ledger,
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
    processors: [...flow.processors, ...reactionProcessors],
    ledger,
    store,
    injector: use,
    canceller,
  })
}

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
  adapter,
  async,

  emit,
  invoke,

  container,

  kernel,

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
