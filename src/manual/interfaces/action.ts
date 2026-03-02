export interface BaseAction {
  type: string
}

export interface EmitAction<TEvent> extends BaseAction {
  type: 'emit'
  payload: TEvent
}

export interface InvokeAction {
  type: 'invoke'
  skill: string
}

export type Action<TEvent> =
  | EmitAction<TEvent>
  | InvokeAction
