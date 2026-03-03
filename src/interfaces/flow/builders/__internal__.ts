export const BUILD = Symbol()

export interface Buildable<T> {
  [BUILD](): T
}

export function isBuildable(input: unknown): input is { [BUILD]: () => object } {
  return typeof input === 'object'
    && input !== null
    && input.hasOwnProperty(BUILD)
}

export function build<T>(buildable: Buildable<T>) {
  return buildable[BUILD]()
}
