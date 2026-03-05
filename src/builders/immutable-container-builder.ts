import { ContainerBuilder, ContainerEntry, ServiceFactory } from '../interfaces/builders/container-builder.js'
import { Type } from '../interfaces/event-generator.js'
import { BUILD } from '../interfaces/builders/__internal__.js'
import { ContainerEntity } from '../interfaces/entities/container-entity.js'

type RegistryNode = {
  type: Type
  entry: ContainerEntry
  parent: RegistryNode | null
}

export class ImmutableContainerBuilder implements ContainerBuilder {
  constructor(private readonly head: RegistryNode | null = null) { }

  service<T extends Type>(type: T, instance: InstanceType<Type>): this {
    return new ImmutableContainerBuilder({
      type,
      entry: { type: 'service', instance },
      parent: this.head,
    }) as this
  }

  factory<T extends Type>(type: T, factory: ServiceFactory): this {
    return new ImmutableContainerBuilder({
      type,
      entry: { type: 'factory', factory },
      parent: this.head,
    }) as this
  }

  [BUILD](): ContainerEntity {
    return {
      use: (() => {
        const services = new Map<Type, InstanceType<Type>>()
        const factories = new Map<Type, ServiceFactory>()

        let current = this.head

        while (current !== null) {
          if (!services.has(current.type) && !factories.has(current.type)) {
            if (current.entry.type === 'factory') {
              factories.set(current.type, current.entry.factory)
            } else {
              services.set(current.type, current.entry.instance)
            }
          }
          current = current.parent
        }

        return function injector<T extends Type>(type: T): InstanceType<T> {
          const cached = services.get(type)
          if (cached) return cached as InstanceType<T>

          const factory = factories.get(type)
          if (!factory) throw new Error(`Type ${type.name} not registered.`)

          const service = factory(injector)
          services.set(type, service)
          factories.delete(type)

          return service as InstanceType<T>
        }
      })(),
    }
  }
}
