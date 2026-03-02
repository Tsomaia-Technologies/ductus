import Ductus from 'ductus'
import ImplementationReportEvent from '../events/ImplementationReportEvent.mjs';
import EngineerAgent from '../agents/EngineerAgent.mjs';

export default Ductus.reaction('ResolveCommentsReaction')
    .invoke(EngineerAgent.skills.resolveComments)
    .emit(ImplementationReportEvent)
