import { BUILD } from '../interfaces/builders/__internal__.js'
import { ModelBuilder } from '../interfaces/builders/model-builder.js'
import { ModelEntity } from '../interfaces/entities/model-entity.js'

interface ModelBuilderParams {
  modelId?: string
  temperature: number | null
}

export class ImmutableModelBuilder implements ModelBuilder {
  private params: ModelBuilderParams

  constructor() {
    this.params = {
      temperature: null,
    }
  }

  model(modelId: string): this {
    return this.clone({ modelId })
  }

  temperature(value: number | null): this {
    return this.clone({ temperature: value })
  }

  [BUILD](): ModelEntity {
    if (!this.params.modelId) throw new Error('Model requires an id/name.')

    return {
      model: this.params.modelId,
      temperature: this.params.temperature,
    }
  }

  private clone(params: Partial<ModelBuilderParams>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
