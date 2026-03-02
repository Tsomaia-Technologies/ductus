import { Event } from 'ductus'
import TaskSchema from "../schemas/TaskSchema.mjs";

export default Event.define('Task')
    .payload(TaskSchema)
