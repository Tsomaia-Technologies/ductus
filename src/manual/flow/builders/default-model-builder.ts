import { BUILD } from '../../interfaces/flow/builders/__internal__.js'
import { ModelBuilder } from '../../interfaces/flow/builders/model-builder.js'
import { ModelEntity } from '../../interfaces/flow/entities/model-entity.js'

export class DefaultModelBuilder implements ModelBuilder {
    private _modelId?: string
    private _temperature: number | null = null

    model(modelId: string): this {
        this._modelId = modelId
        return this
    }

    temperature(value: number | null): this {
        this._temperature = value
        return this
    }

    [BUILD](): ModelEntity {
        if (!this._modelId) throw new Error('Model requires an id/name.')

        return {
            model: this._modelId,
            temperature: this._temperature,
        }
    }
}
