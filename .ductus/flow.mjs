import Ductus from 'ductus'
import ReviewerAgent from './agents/ReviewerAgent.mjs';
import EngineerAgent from './agents/EngineerAgent.mjs';
import state from './state.mjs';
import RootReducer from './reducers/RootReducer.mjs';
import ImplementationReaction from './reactions/ImplementationReaction.mjs';
import ResolveCommentsReaction from './reactions/ResolveCommentsReaction.mjs';
import ReviewReaction from './reactions/ReviewReaction.mjs';

export default Ductus.flow()
    .initialState(state)
    .reducer(RootReducer)
    .agents(
        EngineerAgent,
        ReviewerAgent,
    )
    .reactions(
        ImplementationReaction,
        ReviewReaction,
        ResolveCommentsReaction,
    )
