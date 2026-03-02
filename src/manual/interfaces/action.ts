import { BaseEvent } from './event.js'

export interface BaseAction {
  type: string
}

export interface EmitAction<TEvent extends BaseEvent> extends BaseAction {
  type: 'emit'
  payload: TEvent
}

export interface InvokeAction {
  type: 'invoke'
  skill: string
}

export type Action<TEvent extends BaseEvent> =
  | EmitAction<TEvent>
  | InvokeAction
