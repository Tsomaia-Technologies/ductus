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
import { EventDefinition, EventPayloadShape, PayloadShape } from './interfaces/event.js'
import { DuctusKernel } from './core/ductus-kernel.js'
import { ImmutableRulesetBuilder } from './builders/immutable-ruleset-builder.js'
import { AgentDispatcher, TemplateRenderer } from './core/agent-dispatcher.js'
import { DuctusStore } from './core/ductus-store.js'
import * as zod from 'zod/v3'
import { createEventFactory, createProcessorAdapter, createReactionAdapter } from './utils/internals.js'
import { AgentBuilder } from './interfaces/builders/agent-builder.js'
import { FlowBuilder } from './interfaces/builders/flow-builder.js'
import { ModelBuilder } from './interfaces/builders/model-builder.js'
import { ReactionBuilder } from './interfaces/builders/reaction-builder.js'
import { ReducerBuilder } from './interfaces/builders/reducer-builder.js'
import { RulesetBuilder } from './interfaces/builders/ruleset-builder.js'
import { SkillBuilder } from './interfaces/builders/skill-builder.js'
import { ProcessorBuilder } from './interfaces/builders/processor-builder.js'
import { AdapterBuilder } from './interfaces/builders/adapter-builder.js'
import { Multiplexer } from './interfaces/multiplexer.js'
import { EventLedger } from './interfaces/event-ledger.js'
import { DependencyContainer } from './interfaces/dependency-container.js'
import { CancellationToken } from './interfaces/cancellation-token.js'
import { SystemAdapter } from './interfaces/system-adapter.js'
import { FileAdapter } from './interfaces/file-adapter.js'
import { AsyncEntity } from './interfaces/entities/async-entity.js'

export interface CreateKernelOptions<TState> {
  flow: FlowEntity<TState>
  multiplexer: Multiplexer
  ledger: EventLedger
  container: DependencyContainer
  templateRenderer: TemplateRenderer
  systemAdapter: SystemAdapter
  fileAdapter: FileAdapter
  canceller?: CancellationToken
}

function event<TType extends string, TPayloadShape extends EventPayloadShape>(
  type: TType,
  payloadShape: PayloadShape<TPayloadShape>,
) {
  return createEventFactory({ type, payloadShape, volatility: 'durable' })
}

function signal<TType extends string, TPayloadShape extends EventPayloadShape>(
  type: TType,
  payloadShape: PayloadShape<TPayloadShape>,
) {
  return createEventFactory({ type, payloadShape, volatility: 'volatile' })
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

function processor<TState>(generator: EventGenerator<TState>): ProcessorBuilder<TState> {
  return new ImmutableProcessorBuilder<TState>().processor(generator)
}

function adapter(type: 'cli'): AdapterBuilder {
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

export function kernel<TState>(
  options: CreateKernelOptions<TState>,
) {
  const {
    flow,
    multiplexer,
    ledger,
    container,
    canceller,
    templateRenderer,
    systemAdapter,
    fileAdapter,
  } = options

  const use = container.use.bind(container) as Injector

  const store = new DuctusStore(
    flow.initialState,
    flow.reducer.reducer,
  )

  const dispatcher = new AgentDispatcher({
    agents: flow.agents,
    ledger,
    store,
    templateRenderer,
    injector: use,
    systemAdapter,
    fileAdapter,
  })

  const processors = flow.processors.map(entity => {
    return createProcessorAdapter(entity.processor)
  })

  const reactionProcessors = flow.reactions.map(entity => {
    return createReactionAdapter(entity, dispatcher)
  })

  const kernel = new DuctusKernel({
    multiplexer,
    processors: [...processors, ...reactionProcessors],
    ledger,
    store,
    injector: use,
    canceller,
  })

  container.register(AgentDispatcher, dispatcher)
  container.register(DuctusKernel, kernel)

  return kernel
}

const literal = zod.literal
const boolean = zod.boolean
const string = zod.string
const number = zod.number
const _null = zod.null
const nullable = zod.nullable
const date = zod.date
const union = zod.union
const discriminatedUnion = zod.discriminatedUnion
const object = zod.strictObject
const array = zod.array
const _enum = zod.enum

export default {
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
