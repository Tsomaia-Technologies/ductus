export type EventCallback<TEvent> = (event: TEvent) => void

export interface EventListener<TEvent = void> {
  on(callback: EventCallback<TEvent>): () => void
  once(callback: EventCallback<TEvent>): () => void
  wait(): Promise<TEvent>
  trigger(event: TEvent): void
}
