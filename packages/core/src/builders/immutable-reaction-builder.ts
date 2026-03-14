import { build, BUILD } from '../interfaces/builders/__internal__.js'
import {
  InvokeBuildStep,
  InvokeCursorBuilder,
  PipelineBuildAction,
  PipelineBuildStep,
  ReactionBuilder,
} from '../interfaces/builders/reaction-builder.js'
import { PipelineAction, PipelineContext, ReactionEntity } from '../interfaces/entities/reaction-entity.js'
import { BaseEventDefinition, EventDefinition } from '../interfaces/event.js'
import { Schema } from '../interfaces/schema.js'
import { AgentBuilder } from '../interfaces/builders/agent-builder.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'

interface ReactionBuilderParams {
  readonly name?: string
  readonly triggers: Array<EventDefinition>
  readonly pipeline: PipelineBuildStep[]
}

export class ImmutableReactionBuilder<T = unknown> implements ReactionBuilder<T> {
  private params: ReactionBuilderParams

  constructor(params?: ReactionBuilderParams) {
    this.params = params ?? {
      name: undefined,
      triggers: [],
      pipeline: [],
    }
  }

  name(name: string) {
    return this.clone<T>({ name })
  }

  when(...events: EventDefinition[]) {
    return this.clone<T>({
      triggers: [...this.params.triggers, ...events],
    })
  }

  invoke<U>(agent: AgentBuilder, skill: SkillBuilder<U>): InvokeCursorBuilder<U> {
    return new ImmutableInvokeCursorBuilder<U>(this.params, {
      type: 'invoke',
      agent,
      skill,
    })
  }

  emit(event: BaseEventDefinition<string, T>) {
    return this.clone<T>({
      pipeline: [...this.params.pipeline, { type: 'emit', event }],
    })
  }

  map<U>(transform: (input: T, context: PipelineContext) => U): ReactionBuilder<U> {
    return this.clone<U>({
      pipeline: [...this.params.pipeline, { type: 'map', transform }],
    })
  }

  assert(
    validate: (data: T, context: PipelineContext) => void,
  ): ReactionBuilder<T> {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'assert', validate }],
    })
  }

  error<U>(transform: (error: unknown, context: PipelineContext) => U): ReactionBuilder<T | U> {
    return this.clone<T | U>({
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

  private clone<U>(
    params: Partial<ReactionBuilderParams>,
  ): ReactionBuilder<U> {
    const Constructor = this.constructor as new (
      params: ReactionBuilderParams,
    ) => ReactionBuilder<U>
    return new Constructor({ ...this.params, ...params })
  }
}

class ImmutableInvokeCursorBuilder<T = unknown>
  implements InvokeCursorBuilder<T> {
  constructor(
    private readonly parentParams: ReactionBuilderParams,
    private readonly invokeStep: InvokeBuildStep,
    private readonly steps: PipelineBuildStep[] = [],
  ) {
  }

  name(name: string): ReactionBuilder<T> {
    return this.escape().name(name)
  }

  case(schema: Schema, action: PipelineBuildAction): InvokeCursorBuilder<T> {
    return this.with({ type: 'case', schema, then: action })
  }

  emit(event: BaseEventDefinition<string, T>) {
    return this.escape().emit(event)
  }

  when(...events: EventDefinition[]): ReactionBuilder<T> {
    return this.escape().when(...events)
  }

  invoke<U>(agent: AgentBuilder, skill: SkillBuilder<U>): InvokeCursorBuilder<U> {
    return this.escape().invoke(agent, skill)
  }

  map<U>(transform: (input: T, context: PipelineContext) => U): ReactionBuilder<U> {
    return this.escape().map(transform)
  }

  assert(
    validate: (data: T, context: PipelineContext) => void,
  ): ReactionBuilder<T> {
    return this.escape().assert(validate)
  }

  error<U>(transform: (error: unknown, context: PipelineContext) => U): ReactionBuilder<T | U> {
    return this.escape().error(transform)
  }

  [BUILD](): ReactionEntity {
    return this.escape()[BUILD]()
  }

  private with(step: PipelineBuildStep): InvokeCursorBuilder<T> {
    return new ImmutableInvokeCursorBuilder(
      this.parentParams,
      this.invokeStep,
      [...this.steps, step],
    )
  }

  private escape(): ReactionBuilder<T> {
    return new ImmutableReactionBuilder<T>({
      ...this.parentParams,
      pipeline: [...this.parentParams.pipeline, this.invokeStep, ...this.steps],
    })
  }
}
