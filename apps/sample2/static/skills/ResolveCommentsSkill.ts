import Ductus from 'ductus'
import RejectionSchema from '../schemas/RejectionSchema.js'
import ImplementationReportSchema from '../schemas/ImplementationReportSchema.js'

export default Ductus.skill('resolveComments')
    .input(RejectionSchema, '../templates/rejection.mx')
    .output(ImplementationReportSchema)
