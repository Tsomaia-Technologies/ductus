import Ductus from 'ductus'
import { ExploreOutput } from './schemas.js'

export const SystemPromptQuery = Ductus.event('UserInputRequest', {
  requestId: Ductus.string(),
  query: Ductus.string(),
})

export const SystemPromptResponse = Ductus.event('UserInputRequest', {
  requestId: Ductus.string(),
  response: Ductus.string(),
})

export const ExploreRequest = Ductus.event('ExploreRequest', {
  request: Ductus.string(),
})

export const ExploreResponse = Ductus.event(
  'ExplorationReport',
  ExploreOutput,
)
