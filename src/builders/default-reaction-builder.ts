import { BUILD } from '../interfaces/builders/__internal__.js'
import { InvokeCursorBuilder, ReactionBuilder } from '../interfaces/builders/reaction-builder.js'
import { InvokeStep, PipelineStep, ReactionEntity } from '../interfaces/entities/reaction-entity.js'
import { BaseEvent } from '../interfaces/event.js'
import { Schema } from '../interfaces/schema.js'

class DefaultInvokeCursorBuilder<TEvent extends BaseEvent> implements InvokeCursorBuilder<TEvent> {
  private readonly parent: DefaultReactionBuilder<TEvent>
  private readonly invokeStep: InvokeStep
  private readonly cases: PipelineStep<TEvent>[] = []

  constructor(
    parent: DefaultReactionBuilder<TEvent>,
    params: { agent: string, skill: string },
  ) {
    this.parent = parent
    this.invokeStep = { ...params, type: 'invoke' }
  }

  case(schema: Schema, action: ReactionBuilder<TEvent>): InvokeCursorBuilder<TEvent> {
    const nested = action[BUILD]()
    this.cases.push({
      type: 'case',
      schema,
      then: nested.pipeline,
    })
    return this
  }

  emit(event: TEvent): ReactionBuilder<TEvent> {
    this.finalize()
    return this.parent.emit(event)
  }

  when(...events: TEvent[]): ReactionBuilder<TEvent> {
    this.finalize()
    return this.parent.when(...events)
  }

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder<TEvent> {
    this.finalize()
    return this.parent.invoke(params)
  }

  finalize(): void {
    this.parent._pushStep(this.invokeStep)
    for (const c of this.cases) {
      this.parent._pushStep(c)
    }
  }
}

export class DefaultReactionBuilder<TEvent extends BaseEvent> implements ReactionBuilder<TEvent> {
  private readonly _triggers: TEvent[] = []
  private readonly _pipeline: PipelineStep<TEvent>[] = []
  private _currentCursor?: DefaultInvokeCursorBuilder<TEvent>

  when(...events: TEvent[]): this {
    this._flushCursor()
    this._triggers.push(...events)
    return this
  }

  invoke(params: { agent: string, skill: string }): InvokeCursorBuilder<TEvent> {
    this._flushCursor()
    this._currentCursor = new DefaultInvokeCursorBuilder(this, params)
    return this._currentCursor
  }

  emit(event: TEvent): this {
    this._flushCursor()
    this._pipeline.push({ type: 'emit', event })
    return this
  }

  /** @internal — used by cursor builder to push steps */
  _pushStep(step: PipelineStep<TEvent>): void {
    this._pipeline.push(step)
  }

  [BUILD](): ReactionEntity<TEvent> {
    this._flushCursor()

    if (this._triggers.length === 0) {
      throw new Error('Reaction requires at least one event in .when()')
    }

    return {
      triggers: this._triggers.map(event => event.type),
      pipeline: [...this._pipeline],
    }
  }

  private _flushCursor(): void {
    if (this._currentCursor) {
      this._currentCursor.finalize()
      this._currentCursor = undefined
    }
  }
}
