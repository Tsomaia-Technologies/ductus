import { BUILD } from '../interfaces/builders/__internal__.js'
import { InvokeCursorBuilder, ReactionBuilder } from '../interfaces/builders/reaction-builder.js'
import { InvokeStep, PipelineStep, ReactionEntity } from '../interfaces/entities/reaction-entity.js'
import { BaseEvent } from '../interfaces/event.js'
import { Schema } from '../interfaces/schema.js'

interface ReactionBuilderParams<TEvent extends BaseEvent> {
  name?: string
  readonly triggers: TEvent[]
  readonly pipeline: PipelineStep<TEvent>[]
}

export class ImmutableReactionBuilder<TEvent extends BaseEvent> implements ReactionBuilder<TEvent> {
  private params: ReactionBuilderParams<TEvent>

  constructor(params?: ReactionBuilderParams<TEvent>) {
    this.params = params ?? {
      name: undefined,
      triggers: [],
      pipeline: [],
    }
  }

  name(name: string) {
    return this.clone({ name })
  }

  when(...events: TEvent[]): this {
    return this.clone({
      triggers: [...this.params.triggers, ...events]
    })
  }

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder<TEvent> {
    return new ImmutableInvokeCursorBuilder(this.params, { ...params, type: 'invoke' })
  }

  emit(event: TEvent): this {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'emit', event }]
    })
  }

  [BUILD](): ReactionEntity<TEvent> {
    if (this.params.triggers.length === 0) {
      throw new Error('Reaction requires at least one event in .when()')
    }

    return {
      triggers: this.params.triggers.map(event => event.type),
      pipeline: [...this.params.pipeline],
    }
  }

  private clone(params: Partial<ReactionBuilderParams<TEvent>>): this {
    const Constructor = this.constructor as new (params: ReactionBuilderParams<TEvent>) => this
    return new Constructor({ ...this.params, ...params })
  }
}

class ImmutableInvokeCursorBuilder<TEvent extends BaseEvent> implements InvokeCursorBuilder<TEvent> {
  constructor(
    private readonly parentParams: ReactionBuilderParams<TEvent>,
    private readonly invokeStep: InvokeStep,
    private readonly cases: PipelineStep<TEvent>[] = []
  ) { }

  name(name: string): ReactionBuilder<TEvent> {
    return this.escape().name(name)
  }

  case(schema: Schema, action: ReactionBuilder<TEvent>): InvokeCursorBuilder<TEvent> {
    const nested = action[BUILD]()
    return new ImmutableInvokeCursorBuilder(
      this.parentParams,
      this.invokeStep,
      [...this.cases, { type: 'case', schema, then: nested.pipeline }]
    )
  }

  emit(event: TEvent): ReactionBuilder<TEvent> {
    return this.escape().emit(event)
  }

  when(...events: TEvent[]): ReactionBuilder<TEvent> {
    return this.escape().when(...events)
  }

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder<TEvent> {
    return this.escape().invoke(params)
  }

  private escape(): ImmutableReactionBuilder<TEvent> {
    return new ImmutableReactionBuilder({
      ...this.parentParams,
      pipeline: [...this.parentParams.pipeline, this.invokeStep, ...this.cases]
    })
  }
}
