import Ductus from 'ductus'
import initialState from './initialState.js'
import RootReducer from './reducers/RootReducer.js'
import EngineerAgent from './agents/EngineerAgent.js'
import ReviewerAgent from './agents/ReviewerAgent.js'
import { ClaudeOpus4_6 } from './models/index.js'
import CliAdapter from './adapters/CliAdapter.js'
import ImplementationReaction from './reactions/ImplementationReaction.js'
import ResolveCommentsReaction from './reactions/ResolveCommentsReaction.js'
import ReviewReaction from './reactions/ReviewReaction.js'
import LogProcessor from './processors/LogProcessor.js'

export default Ductus.flow()
  .initialState(initialState)
  .reducer(RootReducer)

  .agent(EngineerAgent, ClaudeOpus4_6, CliAdapter)
  .agent(ReviewerAgent, ClaudeOpus4_6, CliAdapter)

  .reaction(ImplementationReaction)
  .reaction(ResolveCommentsReaction)
  .reaction(ReviewReaction)

  .processor(LogProcessor)
