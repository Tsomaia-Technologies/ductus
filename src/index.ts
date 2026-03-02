import { DefaultAgentBuilder } from './manual/flow/builders/default-agent-builder.js'
import { DefaultSkillBuilder } from './manual/flow/builders/default-skill-builder.js'
import { DefaultEventBuilder } from './manual/flow/builders/default-event-builder.js'
import { DefaultProcessorBuilder } from './manual/flow/builders/default-processor-builder.js'
import { EventGenerator, Injector } from './manual/interfaces/event-generator.js'
import { DefaultReactionBuilder } from './manual/flow/builders/default-reaction-builder.js'
import { DefaultReducerBuilder } from './manual/flow/builders/default-reducer-builder.js'
import { DefaultFlowBuilder } from './manual/flow/builders/default-flow-builder.js'
import { DefaultModelBuilder } from './manual/flow/builders/default-model-builder.js'
import { FlowEntity } from './manual/interfaces/flow/entities/flow-entity.js'
import { Multiplexer } from './manual/interfaces/multiplexer.js'
import { EventLedger } from './manual/interfaces/event-ledger.js'
import { EventProcessor } from './manual/interfaces/event-processor.js'
import { ReactionEntity } from './manual/interfaces/flow/entities/reaction-entity.js'
import { AgentEntity } from './manual/interfaces/flow/entities/agent-entity.js'
import { ModelEntity } from './manual/interfaces/flow/entities/model-entity.js'
import { BaseEvent, CommittedEvent } from './manual/interfaces/event.js'
import { DuctusKernel } from './manual/core/ductus-kernel.js'

export function createDuctus<TEvent extends BaseEvent, TState>() {
  return {
    agent: (name: string) => new DefaultAgentBuilder().name(name),
    event: (name: string) => new DefaultEventBuilder().type(name),
    flow: () => new DefaultFlowBuilder<TEvent, TState>(),
    model: (modelId: string) => new DefaultModelBuilder().model(modelId),
    reaction: () => new DefaultReactionBuilder<TEvent>(),
    reducer: () => new DefaultReducerBuilder<TEvent, TState>(),
    skill: (name: string) => new DefaultSkillBuilder().name(name),
    processor: (generator: EventGenerator<TEvent, TState>) =>
      new DefaultProcessorBuilder<TEvent, TState>().processor(generator),
  }
}

export interface CreateKernelOptions<TEvent extends BaseEvent, TState> {
  flow: FlowEntity<TEvent, TState>
  multiplexer: Multiplexer<TEvent>
  ledger: EventLedger<CommittedEvent<TEvent>>
  injector: Injector
}

export function createKernel<TEvent extends BaseEvent, TState>(
  options: CreateKernelOptions<TEvent, TState>,
) {
  const { flow, multiplexer, ledger, injector } = options

  const processors = flow.processors.map(entity => {
    return createProcessorAdapter(entity.processor)
  })

  const reactionProcessors = flow.reactions.map(entity => {
    return createReactionAdapter(entity, flow.agents)
  })

  return new DuctusKernel({
    initialState: flow.initialState,
    reducer: flow.reducer.reducer,
    multiplexer,
    processors: [...processors, ...reactionProcessors],
    ledger,
    injector,
  })
}

export function createProcessorAdapter<TEvent extends BaseEvent, TState>(
  generator: EventGenerator<TEvent, TState>,
): EventProcessor<TEvent, TState> {
  return {
    process: generator,
  }
}

export function createReactionAdapter<TEvent extends BaseEvent, TState>(
  reaction: ReactionEntity<TEvent>,
  agents: Array<{ agent: AgentEntity; model: ModelEntity }>,
): EventProcessor<TEvent, TState> {
  return createProcessorAdapter(async function* (events, getState) {
    for await (const event of events) {
      if (!reaction.events.includes(event.type)) continue

      for (const action of reaction.reactions) {
        switch (action.type) {
          case 'emit':
            yield action.payload
            break

          case 'invoke':
            // handle LLM request
            break
        }
      }
    }
  })
}
