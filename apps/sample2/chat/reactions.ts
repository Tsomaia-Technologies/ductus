import Ductus from 'ductus'
import { ExploreRequest, ExploreResponse } from './events.js'
import { ExplorerAgent } from './agents.js'
import { ExploreSkill } from './skills.js'

export const ExploreReaction = Ductus.reaction('ExploreReaction')
  .when(ExploreRequest)
  .invoke(ExplorerAgent, ExploreSkill)
  .emit(ExploreResponse)
  .map(input => ({
    hello: 'string'
  }))
  .emit(Ductus.event('ev', {
    hello: Ductus.string(),
  }))
