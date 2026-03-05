import { EventDefinition } from './event.js'

export interface BaseAction {
  type: string
}

export interface EmitAction extends BaseAction {
  type: 'emit'
  payload: EventDefinition
}

export interface InvokeAction {
  type: 'invoke'
  skill: string
}

export type Action =
  | EmitAction
  | InvokeAction
