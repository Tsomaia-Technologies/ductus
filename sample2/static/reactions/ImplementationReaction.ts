import Ductus from 'ductus'
import EngineerAgent from '../agents/EngineerAgent.js'
import { ImplementationReportEvent, TaskEvent } from '../events/index.js'

export default Ductus.reaction('ImplementationReaction')
  .when(TaskEvent)
  .invoke(EngineerAgent.skills.implement)
  .emit(ImplementationReportEvent)
