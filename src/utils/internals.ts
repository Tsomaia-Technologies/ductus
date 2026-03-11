import * as zod from 'zod/v3'
import { OutputEventStream } from '../interfaces/output-event-stream.js'
import {
  BaseEvent, CommittedEvent, EVENT_DEFINITION,
  EventDefinition,
  EventPayloadShape,
  IntentDefinition,
  PayloadShape,
  Volatility,
} from '../interfaces/event.js'
import { isSchemaType } from './schema-utils.js'
import { ErrorStep, PipelineContext, PipelineStep, ReactionEntity } from '../interfaces/entities/reaction-entity.js'
import { AgentDispatcher } from '../core/agent-dispatcher.js'
import { EventProcessor } from '../interfaces/event-processor.js'
import { Injector } from '../interfaces/event-generator.js'
import { AgentEntity } from '../interfaces/entities/agent-entity.js'
import { SkillEntity } from '../interfaces/entities/skill-entity.js'

export function createEventFactory<TType extends string, TPayloadShape extends EventPayloadShape>(params: {
  type: TType
  payloadShape: PayloadShape<TPayloadShape>
  volatility: Volatility,
}): EventDefinition<TType, TPayloadShape> {
  const { type, payloadShape, volatility } = params
  const payloadSchema = isSchemaType(payloadShape)
    ? payloadShape
    : zod.strictObject(payloadShape)
  type TPayload = zod.input<zod.ZodObject<TPayloadShape, 'strict'>>
  type TEvent = BaseEvent<TType, zod.input<zod.ZodObject<TPayloadShape, 'strict'>>>

  const createEvent = (payload: TPayload): BaseEvent<TType, TPayload> => {
    const validatedPayload = payloadSchema.parse(payload)

    return {
      type,
      payload: validatedPayload,
      volatility,
      isCommited: false,
    }
  }

  Object.assign(createEvent, {
    [EVENT_DEFINITION]: true,
    type,
    volatility,
    payloadSchema,
    is: (event: EventDefinition | BaseEvent): event is TEvent => event.type === type,
  })

  return createEvent as unknown as EventDefinition<TType, TPayloadShape>
}

export function createIntentFactory<TType extends string, TPayload>(
  type: TType
): IntentDefinition<TType, TPayload> {
  type TEvent = BaseEvent<TType, TPayload>

  const createIntent = (payload: TPayload): BaseEvent<TType, TPayload> => {
    return {
      type,
      payload,
      volatility: 'intent',
      isCommited: false,
    }
  }

  Object.assign(createIntent, {
    [EVENT_DEFINITION]: true,
    type,
    volatility: 'intent',
    is: (event: EventDefinition | BaseEvent): event is TEvent => event.type === type,
  })

  return createIntent as unknown as IntentDefinition<TType, TPayload>
}

export function createReactionAdapter<TState>(
  reaction: ReactionEntity,
  dispatcher: AgentDispatcher<TState>,
): EventProcessor<TState> {
  return {
    name: reaction.name,
    process: async function* (events, getState, use) {
      for await (const event of events) {
        if (!reaction.triggers.includes(event.type)) continue

        yield* executePipeline(
          reaction.pipeline,
          event.payload,
          dispatcher,
          event,
          getState,
          use,
        )
      }
    },
  }
}

async function* executePipeline<TState>(
  steps: PipelineStep[],
  input: unknown,
  dispatcher: AgentDispatcher<TState>,
  triggerEvent: CommittedEvent,
  getState?: () => unknown,
  use?: Injector,
): OutputEventStream {
  let lastInvokeResult: unknown = input
  let lastAgent: AgentEntity | undefined
  let lastSkill: SkillEntity | undefined

  const buildContext = (): PipelineContext => ({
    agent: lastAgent,
    skill: lastSkill,
    triggerEvent,
    getState,
    use,
  })

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]

    if (step.type === 'error') continue

    try {
      switch (step.type) {
        case 'emit':
          yield step.event(lastInvokeResult as Parameters<typeof step.event>[0])
          break

        case 'invoke': {
          lastAgent = step.agent
          lastSkill = step.skill
          const v2Result = await dispatcher.invokeAndParseV2(
            step.agent.name,
            step.skill.name,
            lastInvokeResult,
          )
          lastInvokeResult = v2Result.output
          for (const obsEvent of v2Result.observationEvents) {
            yield obsEvent
          }
          break
        }

        case 'case':
          try {
            const matched = step.schema.parse(lastInvokeResult)
            yield* executePipeline([step.then], matched, dispatcher, triggerEvent, getState, use)
          } catch (error) {
            if (!(error instanceof zod.ZodError)) throw error
          }
          break

        case 'map':
          lastInvokeResult = step.transform(lastInvokeResult, buildContext())
          break

        case 'assert':
          await step.validate(lastInvokeResult, buildContext())
          break
      }
    } catch (error) {
      const errorRelativeIndex = steps.slice(i + 1).findIndex(step => step.type === 'error')

      if (errorRelativeIndex !== -1) {
        const errorStep = steps[i + 1 + errorRelativeIndex] as ErrorStep
        lastInvokeResult = errorStep.transform(error, buildContext())
        i = i + 1 + errorRelativeIndex
      } else {
        return
      }
    }
  }
}
