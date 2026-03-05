import Ductus from 'ductus'
import { ImplementationReportEvent } from '../events/index.js'
import EngineerAgent from '../agents/EngineerAgent.js'

export default Ductus.reaction('ResolveCommentsReaction')
  .invoke(EngineerAgent.skills.resolveComments)
  .emit(ImplementationReportEvent)
