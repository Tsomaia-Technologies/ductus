import { Buildable } from './__internal__.js'
import { Injector, Type } from '../event-generator.js'
import { ContainerEntity } from '../entities/container-entity.js'

export type ServiceFactory = (injector: Injector) => InstanceType<Type>

export interface ContainerServiceEntry {
  type: 'service'
  instance: InstanceType<Type>
}

export interface ContainerSingletonEntry {
  type: 'singleton'
  factory: ServiceFactory
}

export interface ContainerTransientEntry {
  type: 'transient'
  factory: ServiceFactory
}

export type ContainerEntry =
  | ContainerServiceEntry
  | ContainerSingletonEntry
  | ContainerTransientEntry

export interface ContainerBuilder extends Buildable<ContainerEntity> {
  parent(container: ContainerBuilder): this

  with(plugin: ContainerBuilder): this

  service<T extends Type>(type: T, instance: InstanceType<Type>): this

  singleton<T extends Type>(type: T, factory: ServiceFactory): this

  transient<T extends Type>(type: T, factory: ServiceFactory): this
}
