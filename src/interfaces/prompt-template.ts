import { Injector } from './event-generator.js'

export type StaticPromptTemplate = string | { raw: string } | { template: string }

export type PromptTemplate<T> =
  | StaticPromptTemplate
  | ((use: Injector, entity: T) => StaticPromptTemplate | Promise<StaticPromptTemplate>)
