import { Event } from 'ductus'
import TaskSchema from "../schemas/TaskSchema.mjs";
import RejectionSchema from "../schemas/RejectionSchema.mjs";

export default Event.define('ResolveReviewCommentsEvent')
    .payload(RejectionSchema)
