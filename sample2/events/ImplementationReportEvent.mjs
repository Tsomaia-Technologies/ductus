import Ductus from 'ductus'
import ImplementationReportSchema from '../schemas/ImplementationReportSchema.mjs';

export default Ductus.event('ImplementationReportEvent')
    .payload(ImplementationReportSchema)
