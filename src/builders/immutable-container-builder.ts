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
  constructor(
    private readonly head: RegistryNode | null = null,
    private readonly parentBuilder?: ContainerBuilder,
  ) { }

  parent(builder: ContainerBuilder): this {
    return new ImmutableContainerBuilder(this.head, builder) as this
  }

  service<T extends Type>(type: T, instance: InstanceType<Type>): this {
    return new ImmutableContainerBuilder({
      type,
      entry: { type: 'service', instance },
      parent: this.head,
    }, this.parentBuilder) as this
  }

  singleton<T extends Type>(type: T, factory: ServiceFactory): this {
    return new ImmutableContainerBuilder({
      type,
      entry: { type: 'singleton', factory },
      parent: this.head,
    }, this.parentBuilder) as this
  }

  transient<T extends Type>(type: T, factory: ServiceFactory): this {
    return new ImmutableContainerBuilder({
      type,
      entry: { type: 'transient', factory },
      parent: this.head,
    }, this.parentBuilder) as this
  }

  [BUILD](): ContainerEntity {
    const parentContainer = this.parentBuilder
      ? this.parentBuilder[BUILD]()
      : undefined

    return {
      use: (() => {
        const services = new Map<Type, InstanceType<Type>>()
        const singletons = new Map<Type, ServiceFactory>()
        const transients = new Map<Type, ServiceFactory>()
        const currentlyResolving = new Set<Type>()
        const parent = parentContainer

        let current = this.head

        while (current !== null) {
          if (!services.has(current.type) && !singletons.has(current.type) && !transients.has(current.type)) {
            if (current.entry.type === 'singleton') {
              singletons.set(current.type, current.entry.factory)
            } else if (current.entry.type === 'transient') {
              transients.set(current.type, current.entry.factory)
            } else {
              services.set(current.type, current.entry.instance)
            }
          }
          current = current.parent
        }

        return function injector<T extends Type>(
          type: T,
          options?: { optional?: boolean }
        ): InstanceType<T> | (typeof options extends { optional: true } ? undefined : never) {

          const cached = services.get(type)
          if (cached) return cached as InstanceType<T>

          const transientFactory = transients.get(type)
          if (transientFactory) {
            return transientFactory(injector) as InstanceType<T>
          }

          const singletonFactory = singletons.get(type)
          if (!singletonFactory) {
            if (parent) {
              return parent.use(type, options as any)
            }
            if (options?.optional) return undefined as any
            throw new Error(`Type ${type.name} not registered.`)
          }

          if (currentlyResolving.has(type)) {
            throw new Error(`Circular dependency detected while resolving ${type.name}`)
          }

          currentlyResolving.add(type)

          try {
            const service = singletonFactory(injector)
            services.set(type, service)
            singletons.delete(type)

            return service as InstanceType<T>
          } finally {
            currentlyResolving.delete(type)
          }
        }
      })(),
    }
  }
}
