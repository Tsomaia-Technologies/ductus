import Ductus, { SystemAdapter, uuid } from 'ductus'
import { SystemPromptQuery, SystemPromptResponse } from './events.js'

export const BootProcessor = Ductus.processor(async function* (events, getState, use) {
  for await (const event of events) {
    if (Ductus.BootEvent.is(event)) {
      yield SystemPromptQuery({
        requestId: uuid(),
        query: 'Enter your prompt'
      })
      break
    }
  }
})

export const InputProcessor = Ductus.processor(async function* (events, getState, use) {
  const system = use(SystemAdapter)

  for await (const event of events) {
    if (SystemPromptQuery.is(event)) {
      const response = await system.prompt(event.payload.query)
      yield SystemPromptResponse({
        requestId: event.payload.requestId,
        response,
      })
    }
  }
})

export const LogProcessor = Ductus.processor(async function* (events, getState, use) {
  for await (const event of events) {
    // console.log(event.type)
  }
})
