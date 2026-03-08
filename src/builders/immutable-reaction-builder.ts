import { BUILD } from '../interfaces/builders/__internal__.js'
import { InvokeCursorBuilder, ReactionBuilder } from '../interfaces/builders/reaction-builder.js'
import {
  InvokeStep,
  PipelineAction,
  PipelineContext,
  PipelineStep,
  ReactionEntity,
} from '../interfaces/entities/reaction-entity.js'
import { EventDefinition } from '../interfaces/event.js'
import { Schema } from '../interfaces/schema.js'
import { AgentBuilder } from '../interfaces/builders/agent-builder.js'
import { SkillBuilder } from '../interfaces/builders/skill-builder.js'

interface ReactionBuilderParams {
  name?: string
  readonly triggers: Array<EventDefinition>
  readonly pipeline: PipelineStep[]
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

  emit(event: EventDefinition) {
    return this.clone<T, U>({
      pipeline: [...this.params.pipeline, { type: 'emit', event }],
    })
  }

  map<O>(transform: (input: U) => O): ReactionBuilder<U, O> {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'map', transform }],
    })
  }

  assert(
    validate: (error: unknown, context: PipelineContext) => void,
  ): ReactionBuilder<T, U> {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'assert', validate }],
    })
  }

  error<O>(transform: (error: unknown) => O): ReactionBuilder<U, O> {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'error', transform }],
    })
  }

  [BUILD](): ReactionEntity {
    if (this.params.triggers.length === 0) {
      throw new Error('Reaction requires at least one event in .when()')
    }

    return {
      name: this.params.name ?? null,
      triggers: this.params.triggers.map(event => event.type),
      pipeline: [...this.params.pipeline],
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
    private readonly invokeStep: InvokeStep,
    private readonly cases: PipelineStep[] = [],
  ) {
  }

  name(name: string): ReactionBuilder {
    return this.escape().name(name)
  }

  case(schema: Schema, action: PipelineAction): InvokeCursorBuilder<T, U> {
    return new ImmutableInvokeCursorBuilder<T, U>(
      this.parentParams,
      this.invokeStep,
      [...this.cases, { type: 'case', schema, then: action }],
    )
  }

  emit(event: EventDefinition): ReactionBuilder {
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

  map<O>(transform: (input: U) => O): ReactionBuilder<U, O> {
    return this.escape().map(transform)
  }

  assert(
    validate: (error: unknown, context: PipelineContext) => void,
  ): ReactionBuilder<T, U> {
    return this.escape().assert(validate)
  }

  error<O>(transform: (error: unknown) => O): ReactionBuilder<U, O> {
    return this.escape().error(transform)
  }

  [BUILD](): ReactionEntity {
    return this.escape()[BUILD]()
  }

  private escape(): ReactionBuilder<T, U> {
    return new ImmutableReactionBuilder<T, U>({
      ...this.parentParams,
      pipeline: [...this.parentParams.pipeline, this.invokeStep, ...this.cases],
    })
  }
}
