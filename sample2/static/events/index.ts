import Ductus from 'ductus'
import ImplementationReportSchema from '../schemas/ImplementationReportSchema.js'
import RejectionSchema from '../schemas/RejectionSchema.js'
import TaskSchema from '../schemas/TaskSchema.js'
import ApprovalSchema from '../schemas/ApprovalSchema.js'

export const ImplementationReportEvent = Ductus.event(
  'ImplementationReportEvent',
  ImplementationReportSchema,
)

export const ApprovalEvent = Ductus.event(
  'ApprovalEvent',
  ApprovalSchema,
)

export const RejectionEvent = Ductus.event(
  'RejectionEvent',
  RejectionSchema,
)

export const ResolveReviewCommentsEvent = Ductus.event(
  'ResolveReviewCommentsEvent',
  ImplementationReportSchema,
)

export const TaskCompleteEvent = Ductus.event(
  'TaskCompleteEvent',
  TaskSchema,
)

export const TaskEvent = Ductus.event(
  'TaskEvent',
  TaskSchema,
)
