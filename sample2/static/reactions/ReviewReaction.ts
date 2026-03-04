import Ductus from '../core.js'
import ImplementationReport from '../events/ImplementationReportEvent.js'
import ReviewerAgent from '../agents/ReviewerAgent.js'
import ApprovalSchema from '../schemas/ApprovalSchema.js'
import RejectionSchema from '../schemas/RejectionSchema.js'
import RequestChangesEvent from '../events/RequestChangesEvent.js'
import TaskCompleteEvent from '../events/TaskCompleteEvent.js'

export default Ductus.reaction('ReviewReaction')
  .when(ImplementationReport)
  .invoke(ReviewerAgent.skills.review)
  .case(ApprovalSchema, Ductus.emit(TaskCompleteEvent))
  .case(RejectionSchema, Ductus.emit(RequestChangesEvent))
