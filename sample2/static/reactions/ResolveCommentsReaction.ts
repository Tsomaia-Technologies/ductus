import Ductus from '../core.js'
import ImplementationReportEvent from '../events/ImplementationReportEvent.js'
import EngineerAgent from '../agents/EngineerAgent.js'

export default Ductus.reaction('ResolveCommentsReaction')
  .invoke(EngineerAgent.skills.resolveComments)
  .emit(ImplementationReportEvent)
