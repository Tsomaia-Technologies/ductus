import Ductus from '../core.js'
import RejectionSchema from '../schemas/RejectionSchema.js'

export default Ductus.event('ResolveReviewCommentsEvent')
  .payload(RejectionSchema)
