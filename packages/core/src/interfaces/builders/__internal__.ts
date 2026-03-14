export const BUILD = Symbol()

export interface Buildable<T> {
  [BUILD](): T
}

export function isBuildable(input: unknown): input is { [BUILD]: () => object } {
  return typeof input === 'object'
    && input !== null
    && BUILD in input
}

export function build<T>(buildable: Buildable<T>) {
  return buildable[BUILD]()
}
