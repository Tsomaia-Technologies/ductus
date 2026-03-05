import Ductus from '../core.js'
import ImplementationReportSchema from '../schemas/ImplementationReportSchema.js'
import RejectionSchema from '../schemas/RejectionSchema.js'
import TaskSchema from '../schemas/TaskSchema.js'

export const ImplementationReportEvent = Ductus.event(
  'ImplementationReportEvent',
  ImplementationReportSchema,
)

export const ResolveReviewCommentsEvent = Ductus.event(
  'ResolveReviewCommentsEvent',
  RejectionSchema,
)

export const TaskCompleteEvent = Ductus.event(
  'TaskCompleteEvent',
  TaskSchema,
)

export const TaskEvent = Ductus.event(
  'TaskEvent',
  TaskSchema,
)
