import { build, BUILD } from '../interfaces/builders/__internal__.js'
import {
  InvokeBuildStep,
  InvokeCursorBuilder,
  PipelineBuildAction,
  PipelineBuildStep,
  ReactionBuilder,
} from '../interfaces/builders/reaction-builder.js'
import { PipelineAction, PipelineContext, ReactionEntity } from '../interfaces/entities/reaction-entity.js'
import { BaseEventDefinition, EventDefinition, EventPayloadShape } from '../interfaces/event.js'
import { Schema } from '../interfaces/schema.js'
import { AgentBuilder } from '../interfaces/builders/agent-builder.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'

interface ReactionBuilderParams {
  name?: string
  readonly triggers: Array<EventDefinition>
  readonly pipeline: PipelineBuildStep[]
}

export class ImmutableReactionBuilder<U = any> implements ReactionBuilder<U> {
  private params: ReactionBuilderParams

  constructor(params?: ReactionBuilderParams) {
    this.params = params ?? {
      name: undefined,
      triggers: [],
      pipeline: [],
    }
  }

  name(name: string) {
    return this.clone<U>({ name })
  }

  when(...events: EventDefinition[]) {
    return this.clone<U>({
      triggers: [...this.params.triggers, ...events],
    })
  }

  invoke<TInput, TOutput>(
    agent: AgentBuilder,
    skill: SkillBuilder<TInput, TOutput>,
  ): InvokeCursorBuilder<TOutput> {
    return new ImmutableInvokeCursorBuilder<TOutput>(this.params, {
      type: 'invoke',
      agent,
      skill,
    })
  }

  emit(event: BaseEventDefinition<string, U>) {
    return this.clone<U>({
      pipeline: [...this.params.pipeline, { type: 'emit', event }],
    })
  }

  map<O>(transform: (input: U, context: PipelineContext) => O): ReactionBuilder<O> {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'map', transform }],
    })
  }

  assert(
    validate: (data: U, context: PipelineContext) => void,
  ): ReactionBuilder<U> {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'assert', validate }],
    })
  }

  error<O>(transform: (error: unknown, context: PipelineContext) => O): ReactionBuilder<U | O> {
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

  private clone<TOutput>(
    params: Partial<ReactionBuilderParams>,
  ): ReactionBuilder<TOutput> {
    const Constructor = this.constructor as new (
      params: ReactionBuilderParams,
    ) => ReactionBuilder<TOutput>
    return new Constructor({ ...this.params, ...params })
  }
}

class ImmutableInvokeCursorBuilder<U = any>
  implements InvokeCursorBuilder<U> {
  constructor(
    private readonly parentParams: ReactionBuilderParams,
    private readonly invokeStep: InvokeBuildStep,
    private readonly steps: PipelineBuildStep[] = [],
  ) {
  }

  name(name: string): ReactionBuilder {
    return this.escape().name(name)
  }

  case(schema: Schema, action: PipelineBuildAction): InvokeCursorBuilder<U> {
    return this.with({ type: 'case', schema, then: action })
  }

  emit(event: BaseEventDefinition<string, U>) {
    return this.escape().emit(event)
  }

  when(...events: EventDefinition[]): ReactionBuilder {
    return this.escape().when(...events)
  }

  invoke<TInput, TOutput>(
    agent: AgentBuilder,
    skill: SkillBuilder<TInput, TOutput>,
  ): InvokeCursorBuilder<TOutput> {
    return this.escape().invoke(agent, skill)
  }

  map<O>(transform: (input: U, context: PipelineContext) => O): ReactionBuilder<O> {
    return this.escape().map(transform)
  }

  assert(
    validate: (data: U, context: PipelineContext) => void,
  ): ReactionBuilder<U> {
    return this.escape().assert(validate)
  }

  error<O>(transform: (error: unknown, context: PipelineContext) => O): ReactionBuilder<U | O> {
    return this.escape().error(transform)
  }

  [BUILD](): ReactionEntity {
    return this.escape()[BUILD]()
  }

  private with(step: PipelineBuildStep): InvokeCursorBuilder<U> {
    return new ImmutableInvokeCursorBuilder(
      this.parentParams,
      this.invokeStep,
      [...this.steps, step],
    )
  }

  private escape(): ReactionBuilder<U> {
    return new ImmutableReactionBuilder<U>({
      ...this.parentParams,
      pipeline: [...this.parentParams.pipeline, this.invokeStep, ...this.steps],
    })
  }
}
