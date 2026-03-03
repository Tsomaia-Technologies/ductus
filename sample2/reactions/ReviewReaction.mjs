import Ductus from 'ductus'
import ImplementationReport from '../events/ImplementationReportEvent.mjs';
import ReviewerAgent from '../agents/ReviewerAgent.mjs';
import ApprovalSchema from '../schemas/ApprovalSchema.mjs';
import RejectionSchema from '../schemas/RejectionSchema.mjs';
import RequestChangesEvent from '../events/RequestChangesEvent.mjs';
import TaskCompleteEvent from "../events/TaskCompleteEvent.mjs";

export default Ductus.reaction('ReviewReaction')
    .when(ImplementationReport)
    .invoke(ReviewerAgent.skills.review)
        .case(ApprovalSchema, Ductus.emit(TaskCompleteEvent))
        .case(RejectionSchema, Ductus.emit(RequestChangesEvent))
