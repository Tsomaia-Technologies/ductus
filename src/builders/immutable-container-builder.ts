import { ContainerBuilder, ContainerEntry, ServiceFactory } from '../interfaces/builders/container-builder.js'
import { Type } from '../interfaces/event-generator.js'
import { BUILD } from '../interfaces/builders/__internal__.js'
import { ContainerEntity } from '../interfaces/entities/container-entity.js'

export class ImmutableContainerBuilder implements ContainerBuilder {
  private registry = new Map<Type, ContainerEntry>()

  service<T extends Type>(type: T, instance: InstanceType<Type>): this {
    this.registry.set(type, {
      type: 'service',
      instance,
    })
    return this
  }

  factory<T extends Type>(type: T, factory: ServiceFactory): this {
    this.registry.set(type, {
      type: 'factory',
      factory,
    })
    return this
  }

  [BUILD](): ContainerEntity {

  }
}
