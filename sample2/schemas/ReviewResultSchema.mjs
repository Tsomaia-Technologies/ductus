import { Schema } from 'ductus'
import ApprovalSchema from './ApprovalSchema.mjs';
import RejectionSchema from './RejectionSchema.mjs';

export default Schema.oneOf(
    ApprovalSchema,
    RejectionSchema,
)
