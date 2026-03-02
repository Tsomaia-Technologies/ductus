import { Type } from '../interfaces/event-generator.js'
import { DependencyContainer } from '../interfaces/dependency-container.js'

export class DefaultDependencyContainer implements DependencyContainer {
  private instances = new Map<Type, InstanceType<Type>>()

  register<T extends Type>(type: T, instance: InstanceType<Type>): void {
    this.instances.set(type, instance)
  }

  use<T extends Type, U extends InstanceType<T> = InstanceType<T>>(type: T): U {
    const instance = this.instances.get(type)

    if (!instance) {
      throw new TypeError(`No registry found for type ${type.name}`)
    }

    return instance
  }
}
