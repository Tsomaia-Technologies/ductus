import Ductus from 'ductus'
import ApprovalSchema from './ApprovalSchema.js'
import RejectionSchema from './RejectionSchema.js'

export default Ductus.union([
  ApprovalSchema,
  RejectionSchema,
])
