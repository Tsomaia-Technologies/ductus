import Ductus from 'ductus'
import { SystemPromptResponse } from './events.js'

export const Example = Ductus.concurrent('s')
  .when(SystemPromptResponse)
  .maxConcurrency(100)
  .handler(async ({ event, emit }) => {
    //
  })
