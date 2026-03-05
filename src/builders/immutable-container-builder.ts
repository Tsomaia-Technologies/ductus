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
    return {
      use: (() => {
        const registry = this.registry
        const services = new Map<Type, InstanceType<Type>>()

        return function injector<T extends Type>(type: T): InstanceType<T> {
          const service = services.get(type)
          if (service) return service

          const entry = registry.get(type)

          if (!entry) {
            throw new TypeError(`No instance found for type: ${type.name}.`)
          }

          if (entry.type === 'factory') {
            const service = entry.factory(injector)
            services.set(type, service)
            return service
          }

          services.set(type, service)
          return service
        }
      })()
    }
  }
}
