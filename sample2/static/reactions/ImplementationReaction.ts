import Ductus from '../core.js'
import EngineerAgent from '../agents/EngineerAgent.js'
import ImplementationReportEvent from '../events/ImplementationReportEvent.js'
import TaskEvent from '../events/TaskEvent.js'

export default Ductus.reaction('ImplementationReaction')
  .when(TaskEvent)
  .invoke(EngineerAgent.skills.implement)
  .emit(ImplementationReportEvent)
