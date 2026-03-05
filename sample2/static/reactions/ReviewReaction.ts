import Ductus from 'ductus'
import {
  ApprovalEvent,
  ImplementationReportEvent,
  RejectionEvent,
  ResolveReviewCommentsEvent,
} from '../events/index.js'
import ReviewerAgent from '../agents/ReviewerAgent.js'
import ApprovalSchema from '../schemas/ApprovalSchema.js'
import RejectionSchema from '../schemas/RejectionSchema.js'

export default Ductus.reaction('ReviewReaction')
  .when(ImplementationReportEvent, ResolveReviewCommentsEvent)
  .invoke(ReviewerAgent.skills.review)
  .case(ApprovalSchema, Ductus.emit(ApprovalEvent))
  .case(RejectionSchema, Ductus.emit(RejectionEvent))
