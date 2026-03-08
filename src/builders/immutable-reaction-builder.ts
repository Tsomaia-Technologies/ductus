import { BUILD } from '../interfaces/builders/__internal__.js'
import { InvokeCursorBuilder, ReactionBuilder } from '../interfaces/builders/reaction-builder.js'
import { InvokeStep, PipelineAction, PipelineStep, ReactionEntity } from '../interfaces/entities/reaction-entity.js'
import { EventDefinition } from '../interfaces/event.js'
import { Schema } from '../interfaces/schema.js'

interface ReactionBuilderParams {
  name?: string
  readonly triggers: Array<EventDefinition>
  readonly pipeline: PipelineStep[]
}

export class ImmutableReactionBuilder implements ReactionBuilder {
  private params: ReactionBuilderParams

  constructor(params?: ReactionBuilderParams) {
    this.params = params ?? {
      name: undefined,
      triggers: [],
      pipeline: [],
    }
  }

  name(name: string) {
    return this.clone({ name })
  }

  when(...events: EventDefinition[]): this {
    return this.clone({
      triggers: [...this.params.triggers, ...events],
    })
  }

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder {
    return new ImmutableInvokeCursorBuilder(this.params, { ...params, type: 'invoke' })
  }

  emit(event: EventDefinition): this {
    return this.clone({
      pipeline: [...this.params.pipeline, { type: 'emit', event }],
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

  private clone(params: Partial<ReactionBuilderParams>): this {
    const Constructor = this.constructor as new (params: ReactionBuilderParams) => this
    return new Constructor({ ...this.params, ...params })
  }
}

class ImmutableInvokeCursorBuilder implements InvokeCursorBuilder {
  constructor(
    private readonly parentParams: ReactionBuilderParams,
    private readonly invokeStep: InvokeStep,
    private readonly cases: PipelineStep[] = [],
  ) {
  }

  name(name: string): ReactionBuilder {
    return this.escape().name(name)
  }

  case(schema: Schema, action: PipelineAction): InvokeCursorBuilder {
    return new ImmutableInvokeCursorBuilder(
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

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder {
    return this.escape().invoke(params)
  }

  [BUILD](): ReactionEntity {
    return this.escape()[BUILD]()
  }

  private escape(): ImmutableReactionBuilder {
    return new ImmutableReactionBuilder({
      ...this.parentParams,
      pipeline: [...this.parentParams.pipeline, this.invokeStep, ...this.cases],
    })
  }
}
