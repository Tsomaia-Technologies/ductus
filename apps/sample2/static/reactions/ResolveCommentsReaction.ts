import Ductus from 'ductus'
import { ImplementationReportEvent, RejectionEvent } from '../events/index.js'
import EngineerAgent from '../agents/EngineerAgent.js'

export default Ductus.reaction('ResolveCommentsReaction')
  .when(RejectionEvent)
  .invoke(EngineerAgent.skills.resolveComments)
  .emit(ImplementationReportEvent)
