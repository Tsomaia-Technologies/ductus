import Ductus from '../core.js'
import TaskSchema from '../schemas/TaskSchema.js'
import ImplementationReportSchema from '../schemas/ImplementationReportSchema.js'

export default Ductus.skill('implement')
  .input(TaskSchema, '../templates/task.mx')
  .output(ImplementationReportSchema)
