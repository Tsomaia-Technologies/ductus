import Ductus from 'ductus'
import EngineerAgent from '../agents/EngineerAgent.mjs';
import ImplementationReportEvent from '../events/ImplementationReportEvent.mjs';
import TaskEvent from '../events/TaskEvent.mjs';

export default Ductus.reaction('ImplementationReaction')
    .when(TaskEvent)
    .invoke(EngineerAgent.skills.implement)
    .emit(ImplementationReportEvent)
