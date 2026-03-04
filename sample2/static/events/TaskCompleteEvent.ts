import Ductus from '../core.js'
import TaskSchema from '../schemas/TaskSchema.js'

export default Ductus.event('TaskCompleteEvent')
  .payload(TaskSchema)
