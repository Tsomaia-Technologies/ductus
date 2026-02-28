export type DeeplyReadonly<T> = T extends object ? Readonly<{
  [K in keyof T]: DeeplyReadonly<T[K]>
}> : never
