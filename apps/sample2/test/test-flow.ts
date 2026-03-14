import Ductus from 'ductus'
import initialState from '../static/initialState.js'
import RootReducer from '../static/reducers/RootReducer.js'
import EngineerAgent from '../static/agents/EngineerAgent.js'
import ReviewerAgent from '../static/agents/ReviewerAgent.js'
import { ClaudeOpus4_6 } from '../static/models/index.js'
import { TestCliAdapter } from './test-adapters.js'
import ImplementationReaction from '../static/reactions/ImplementationReaction.js'
import ResolveCommentsReaction from '../static/reactions/ResolveCommentsReaction.js'
import ReviewReaction from '../static/reactions/ReviewReaction.js'
import LogProcessor from '../static/processors/LogProcessor.js'
import CompletionProcessor from '../static/processors/CompletionProcessor.js'

export default Ductus.flow()
    .initialState(initialState)
    .reducer(RootReducer)

    // Use the same agents but swap the adapter for our test one
    .agent(EngineerAgent, ClaudeOpus4_6, TestCliAdapter)
    .agent(ReviewerAgent, ClaudeOpus4_6, TestCliAdapter)

    .reaction(ImplementationReaction)
    .reaction(ResolveCommentsReaction)
    .reaction(ReviewReaction)

    .processor(LogProcessor)
    .processor(CompletionProcessor)
