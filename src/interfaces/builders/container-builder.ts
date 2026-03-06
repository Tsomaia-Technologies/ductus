import { Buildable } from './__internal__.js'
import { Injectable, Injector, Token, Type } from '../event-generator.js'
import { ContainerEntity } from '../entities/container-entity.js'

// A ServiceFactory can return any value since tokens can represent interfaces or primitives
export type ServiceFactory = (injector: Injector) => any

export interface ContainerServiceEntry {
  type: 'service'
  instance: InstanceType<Type>
}

export interface ContainerTokenEntry {
  type: 'token'
  instance: any
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
  | ContainerTokenEntry
  | ContainerSingletonEntry
  | ContainerTransientEntry

export interface ContainerBuilder extends Buildable<ContainerEntity> {
  parent(container: ContainerBuilder): this

  with(plugin: ContainerBuilder): this

  service<T extends Type>(type: T, instance: InstanceType<T>): this

  token<T>(token: Token<T>, instance: T): this

  singleton<T extends Injectable>(type: T, factory: ServiceFactory): this

  transient<T extends Injectable>(type: T, factory: ServiceFactory): this

  entries(): Iterable<{ type: Injectable, entry: ContainerEntry }>
}
