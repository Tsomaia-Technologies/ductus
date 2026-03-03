import { Buildable } from './__internal__.js'
import { ModelEntity } from '../entities/model-entity.js'

export interface ModelBuilder extends Buildable<ModelEntity> {
  model(modelId: string): this
  temperature(value: number): this
}
