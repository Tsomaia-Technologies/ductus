import Ductus from 'ductus'
import { ExploreRequest, ExploreResponse } from './events.js'
import { ExplorerAgent } from './agents.js'

export const ExploreReaction = Ductus.reaction('ExploreReaction')
  .when(ExploreRequest)
  .invoke(ExplorerAgent.skills.explore)
  .emit(ExploreResponse)
