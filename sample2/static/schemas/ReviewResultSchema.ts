import Ductus from '../core.js'
import ApprovalSchema from './ApprovalSchema.js'
import RejectionSchema from './RejectionSchema.js'

export default Ductus.union([
  ApprovalSchema,
  RejectionSchema,
])
