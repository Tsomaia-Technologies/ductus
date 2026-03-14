import { BaseEvent } from '../../interfaces/event.js'
import { AsyncChannel } from '../../interfaces/coordination/async-channel.js'

export async function forward(
  source: AsyncIterable<BaseEvent | undefined>,
  target: AsyncChannel<BaseEvent | undefined>,
): Promise<void> {
  for await (const event of source) {
    if (event !== undefined) {
      target.push(event)
    }
  }
}
