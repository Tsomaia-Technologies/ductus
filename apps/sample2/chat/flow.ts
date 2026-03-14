import Ductus from 'ductus'
import initialState from './initialState.js'
import { RootReducer } from './reducers.js'
import { ExplorerAgent } from './agents.js'
import { AutoModel } from './models.js'
import { CursorCliAdapter } from './adapters.js'
import { ExploreReaction } from './reactions.js'
import { BootProcessor, InputProcessor, LogProcessor } from './processors.js'

export default Ductus.flow()
  .initialState(initialState)
  .reducer(RootReducer)

  .agent(ExplorerAgent, AutoModel, CursorCliAdapter)

  .reaction(ExploreReaction)

  .processor(BootProcessor)
  .processor(InputProcessor)
  .processor(LogProcessor)
