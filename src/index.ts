import { DefaultAgentBuilder } from './manual/flow/builders/default-agent-builder.js'
import { DefaultSkillBuilder } from './manual/flow/builders/default-skill-builder.js'
import { DefaultEventBuilder } from './manual/flow/builders/default-event-builder.js'
import { DefaultProcessorBuilder } from './manual/flow/builders/default-processor-builder.js'
import { EventGenerator } from './manual/interfaces/event-generator.js'
import { DefaultReactionBuilder } from './manual/flow/builders/default-reaction-builder.js'
import { DefaultReducerBuilder } from './manual/flow/builders/default-reducer-builder.js'
import { DefaultFlowBuilder } from './manual/flow/builders/default-flow-builder.js'
import { DefaultModelBuilder } from './manual/flow/builders/default-model-builder.js'

export function createDuctus<TEvent, TState>() {
  return {
    agent: (name: string) => new DefaultAgentBuilder().name(name),
    event: (name: string) => new DefaultEventBuilder().name(name),
    flow: () => new DefaultFlowBuilder<TEvent, TState>(),
    model: (modelId: string) => new DefaultModelBuilder().model(modelId),
    reaction: () => new DefaultReactionBuilder<TEvent>(),
    reducer: () => new DefaultReducerBuilder<TEvent, TState>(),
    skill: (name: string) => new DefaultSkillBuilder().name(name),
    processor: (generator: EventGenerator<TEvent, TState>) =>
      new DefaultProcessorBuilder<TEvent, TState>().processor(generator),
  }
}
