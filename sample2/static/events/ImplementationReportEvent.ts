import Ductus from '../core.js'
import ImplementationReportSchema from '../schemas/ImplementationReportSchema.js'

export default Ductus.event('ImplementationReportEvent')
  .payload(ImplementationReportSchema)
