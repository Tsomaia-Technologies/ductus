import { build, BUILD } from '../interfaces/builders/__internal__.js'
import {
  InvokeBuildStep,
  InvokeCursorBuilder,
  PipelineBuildAction,
  PipelineBuildStep,
  ReactionBuilder,
} from '../interfaces/builders/reaction-builder.js'
import { PipelineAction, PipelineContext, ReactionEntity } from '../interfaces/entities/reaction-entity.js'
import { EventDefinition, EventPayloadShape } from '../interfaces/event.js'
import { Schema } from '../interfaces/schema.js'
import { AgentBuilder } from '../interfaces/builders/agent-builder.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'

interface ReactionBuilderParams {
  name?: string
  readonly triggers: Array<EventDefinition>
  readonly pipeline: PipelineBuildStep[]
}

export class ImmutableReactionBuilder<T = any, U = any>
  implements ReactionBuilder<T, U> {
  private params: ReactionBuilderParams

  constructor(params?: ReactionBuilderParams) {
    this.params = params ?? {
      name: undefined,
      triggers: [],
      pipeline: [],
    }
  }

  name(name: string) {
    return this.clone<T, U>({ name })
  }

  when(...events: EventDefinition[]) {
    return this.clone<T, U>({
      triggers: [...this.params.triggers, ...events],
    })
  }

  invoke<TInput, TOutput>(
    agent: AgentBuilder,
    skill: SkillBuilder<TInput, TOutput>,
  ): InvokeCursorBuilder<TInput, TOutput> {
    return new ImmutableInvokeCursorBuilder<TInput, TOutput>(this.params, {
      type: 'invoke',
      agent,
      skill,
    })
  }

  emit(
    event: EventDefinition<string, U extends EventPayloadShape ? U : never>,
  ) {
    return this.clone<T, U>({
      pipeline: [...this.params.pipeline, { type: 'emit', event }],
    })
  }

  map<O>(transform: (input: U, context: PipelineContext) => O): ReactionBuilder<U, O> {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'map', transform }],
    })
  }

  assert(
    validate: (data: U, context: PipelineContext) => void,
  ): ReactionBuilder<T, U> {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'assert', validate }],
    })
  }

  error<O>(transform: (error: unknown, context: PipelineContext) => O): ReactionBuilder<U, O> {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'error', transform }],
    })
  }

  [BUILD](): ReactionEntity {
    if (this.params.triggers.length === 0) {
      throw new Error('Reaction requires at least one event in .when()')
    }

    const buildAction = (action: PipelineBuildAction): PipelineAction => {
      if (action.type === 'invoke') {
        return {
          type: 'invoke',
          agent: build(action.agent),
          skill: build(action.skill),
        }
      }

      return action
    }

    return {
      name: this.params.name ?? null,
      triggers: this.params.triggers.map(event => event.type),
      pipeline: this.params.pipeline.map((step) => {
        if (step.type === 'case') {
          return {
            ...step,
            then: buildAction(step.then),
          }
        }

        return buildAction(step)
      }),
    }
  }

  private clone<TInput, TOutput>(
    params: Partial<ReactionBuilderParams>,
  ): ReactionBuilder<TInput, TOutput> {
    const Constructor = this.constructor as new (
      params: ReactionBuilderParams,
    ) => ReactionBuilder<TInput, TOutput>
    return new Constructor({ ...this.params, ...params })
  }
}

class ImmutableInvokeCursorBuilder<T = any, U = any>
  implements InvokeCursorBuilder<T, U> {
  constructor(
    private readonly parentParams: ReactionBuilderParams,
    private readonly invokeStep: InvokeBuildStep,
    private readonly steps: PipelineBuildStep[] = [],
  ) {
  }

  name(name: string): ReactionBuilder {
    return this.escape().name(name)
  }

  case(schema: Schema, action: PipelineBuildAction): InvokeCursorBuilder<T, U> {
    return this.with({ type: 'case', schema, then: action })
  }

  emit(
    event: EventDefinition<string, U extends EventPayloadShape ? U : never>,
  ) {
    return this.escape().emit(event)
  }

  when(...events: EventDefinition[]): ReactionBuilder {
    return this.escape().when(...events)
  }

  invoke<TInput, TOutput>(
    agent: AgentBuilder,
    skill: SkillBuilder<TInput, TOutput>,
  ): InvokeCursorBuilder<TInput, TOutput> {
    return this.escape().invoke(agent, skill)
  }

  map<O>(transform: (input: U, context: PipelineContext) => O): ReactionBuilder<U, O> {
    return this.escape().map(transform)
  }

  assert(
    validate: (data: U, context: PipelineContext) => void,
  ): ReactionBuilder<T, U> {
    return this.escape().assert(validate)
  }

  error<O>(transform: (error: unknown, context: PipelineContext) => O): ReactionBuilder<U, O> {
    return this.escape().error(transform)
  }

  [BUILD](): ReactionEntity {
    return this.escape()[BUILD]()
  }

  private with(step: PipelineBuildStep): InvokeCursorBuilder<T, U> {
    return new ImmutableInvokeCursorBuilder(
      this.parentParams,
      this.invokeStep,
      [...this.steps, step],
    )
  }

  private escape(): ReactionBuilder<T, U> {
    return new ImmutableReactionBuilder<T, U>({
      ...this.parentParams,
      pipeline: [...this.parentParams.pipeline, this.invokeStep, ...this.steps],
    })
  }
}
