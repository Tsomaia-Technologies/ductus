import { Buildable } from './__internal__.js'
import { Injector, Type } from '../event-generator.js'
import { ContainerEntity } from '../entities/container-entity.js'

export type ServiceFactory = (injector: Injector) => InstanceType<Type>

export interface ContainerServiceEntry {
  type: 'service'
  instance: InstanceType<Type>
}

export interface ContainerServiceFactoryEntry {
  type: 'factory'
  factory: ServiceFactory
}

export type ContainerEntry =
  | ContainerServiceEntry
  | ContainerServiceFactoryEntry

export interface ContainerBuilder extends Buildable<ContainerEntity> {
  service<T extends Type>(type: T, instance: InstanceType<Type>): this

  factory<T extends Type>(type: T, factory: ServiceFactory): this
}
