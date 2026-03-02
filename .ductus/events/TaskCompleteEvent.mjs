import Ductus from 'ductus'
import TaskSchema from '../schemas/TaskSchema.mjs';

export default Ductus.event('TaskCompleteEvent')
    .payload(TaskSchema)
