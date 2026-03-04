import { Type } from './event-generator.js'

export interface DependencyContainer {
  register<T extends Type>(type: T, instance: InstanceType<Type>): void

  use<T extends Type, U extends InstanceType<T> = InstanceType<T>>(type: T): U
}
