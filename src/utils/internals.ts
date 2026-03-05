import * as zod from 'zod/v3/index.js'
import { BaseEvent, EventDefinition, PayloadShape, Volatility } from '../interfaces/event.js'
import { isSchemaType } from './schema-utils.js'
import { PipelineStep, ReactionEntity } from '../interfaces/entities/reaction-entity.js'
import { AgentDispatcher } from '../core/agent-dispatcher.js'
import { EventGenerator } from '../interfaces/event-generator.js'
import { EventProcessor } from '../interfaces/event-processor.js'

export function createEventFactory<TType extends string, TPayloadShape extends zod.ZodRawShape>(params: {
  type: TType
  payloadShape: PayloadShape<TPayloadShape>
  volatility: Volatility,
}): EventDefinition<TType, TPayloadShape> {
  const { type, payloadShape, volatility } = params
  const payloadSchema = isSchemaType(payloadShape)
    ? payloadShape
    : zod.strictObject(payloadShape)
  type TPayload = zod.input<typeof payloadSchema>
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
    type,
    volatility,
    payloadSchema,
    is: (event: BaseEvent): event is TEvent => event.type === type,
  })

  return createEvent as unknown as EventDefinition<TType, TPayloadShape>
}

export function createProcessorAdapter<TState>(
  generator: EventGenerator<TState>,
): EventProcessor<TState> {
  return {
    process: generator,
  }
}

export function createReactionAdapter<TState>(
  reaction: ReactionEntity,
  dispatcher: AgentDispatcher<TState>,
): EventProcessor<TState> {
  return createProcessorAdapter(async function* (events) {
    for await (const event of events) {
      if (!reaction.triggers.includes(event.type)) continue

      yield* executePipeline(
        reaction.pipeline,
        event.payload,
        dispatcher,
      )
    }
  })
}

async function* executePipeline<TState>(
  steps: PipelineStep[],
  input: unknown,
  dispatcher: AgentDispatcher<TState>,
): AsyncIterable<BaseEvent> {
  let lastInvokeResult: unknown = input

  for (const step of steps) {
    switch (step.type) {
      case 'emit':
        yield step.event
        break

      case 'invoke':
        lastInvokeResult = await dispatcher.invokeAndParse(
          step.agent,
          step.skill,
          lastInvokeResult,
        )
        break

      case 'case':
        try {
          const matched = step.schema.parse(lastInvokeResult)
          yield* executePipeline(step.then, matched, dispatcher)
        } catch {
          // Schema didn't match — skip this case branch
        }
        break
    }
  }
}

