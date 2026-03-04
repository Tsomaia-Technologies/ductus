import Ductus from '../core.js'
import ImplementationReportSchema from '../schemas/ImplementationReportSchema.js'
import ReviewSchema from '../schemas/ReviewResultSchema.js'

export default Ductus.skill('review')
  .input(ImplementationReportSchema, '../templates/implementation-report.mx')
  .output(ReviewSchema)
