import { ContainerBuilder, ContainerEntry, ServiceFactory } from '../interfaces/builders/container-builder.js'
import { InferInjectable, Injectable, Token, Type } from '../interfaces/event-generator.js'
import { build, BUILD } from '../interfaces/builders/__internal__.js'
import { ContainerEntity } from '../interfaces/entities/container-entity.js'
import Container from '../../sample2/static/container.js'

type RegistryNode = {
  type: Injectable
  entry: ContainerEntry
  parent: RegistryNode | null
}

export class ImmutableContainerBuilder implements ContainerBuilder {
  constructor(
    public readonly head: RegistryNode | null = null,
    private readonly parentBuilder?: ContainerBuilder,
    private readonly imports: ContainerBuilder[] = [],
  ) { }

  parent(builder: ContainerBuilder): this {
    return new ImmutableContainerBuilder(this.head, builder, this.imports) as this
  }

  with(plugin: ContainerBuilder): this {
    return new ImmutableContainerBuilder(
      this.head,
      this.parentBuilder,
      [...this.imports, plugin]
    ) as this
  }

  service<T extends Type>(type: T, instance: InstanceType<T>): this {
    return new ImmutableContainerBuilder({
      type,
      entry: { type: 'service', instance },
      parent: this.head,
    }, this.parentBuilder, this.imports) as this
  }

  token<T>(token: Token<T>, instance: T): this {
    return new ImmutableContainerBuilder({
      type: token,
      entry: { type: 'token', instance },
      parent: this.head,
    }, this.parentBuilder, this.imports) as this
  }

  singleton<T extends Injectable>(type: T, factory: ServiceFactory): this {
    return new ImmutableContainerBuilder({
      type,
      entry: { type: 'singleton', factory },
      parent: this.head,
    }, this.parentBuilder, this.imports) as this
  }

  transient<T extends Injectable>(type: T, factory: ServiceFactory): this {
    return new ImmutableContainerBuilder({
      type,
      entry: { type: 'transient', factory },
      parent: this.head,
    }, this.parentBuilder, this.imports) as this
  }

  *entries(): Iterable<{ type: Injectable, entry: ContainerEntry }> {
    let current = this.head
    while (current !== null) {
      yield { type: current.type, entry: current.entry }
      current = current.parent
    }
  }

  [BUILD](): ContainerEntity {
    const parentContainer = this.parentBuilder
      ? build(this.parentBuilder)
      : undefined

    return {
      use: (() => {
        const services = new Map<Injectable, any>()
        const singletons = new Map<Injectable, ServiceFactory>()
        const transients = new Map<Injectable, ServiceFactory>()
        const currentlyResolving = new Set<Injectable>()
        const parent = parentContainer
        const processEntry = (type: Injectable, entry: ContainerEntry) => {
          if (!services.has(type) && !singletons.has(type) && !transients.has(type)) {
            if (entry.type === 'singleton') {
              singletons.set(type, entry.factory)
            } else if (entry.type === 'transient') {
              transients.set(type, entry.factory)
            } else {
              services.set(type, entry.instance)
            }
          }
        }

        for (const { type, entry } of this.entries()) {
          processEntry(type, entry)
        }

        for (let i = this.imports.length - 1; i >= 0; i--) {
          for (const { type, entry } of this.imports[i].entries()) {
            processEntry(type, entry)
          }
        }

        return function injector<T extends Injectable>(
          type: T,
          options?: { optional?: boolean }
        ): InferInjectable<T> | (typeof options extends { optional: true } ? undefined : never) {

          const cached = services.get(type)
          if (cached) return cached as InferInjectable<T>

          const transientFactory = transients.get(type)
          if (transientFactory) {
            return transientFactory(injector) as InferInjectable<T>
          }

          const singletonFactory = singletons.get(type)
          if (singletonFactory) {
            if (currentlyResolving.has(type)) {
              const name = typeof type === 'function' ? type.name : type.toString()
              throw new Error(`Circular dependency detected while resolving ${name}`)
            }

            currentlyResolving.add(type)

            try {
              const service = singletonFactory(injector)
              services.set(type, service)
              singletons.delete(type)

              return service as InferInjectable<T>
            } finally {
              currentlyResolving.delete(type)
            }
          }

          if (parent) {
            return parent.use(type, options as any)
          }

          if (options?.optional) return undefined as any
          const name = typeof type === 'function' ? type.name : type.toString()
          throw new Error(`Type ${name} not registered.`)
        }
      })(),
    }
  }
}
