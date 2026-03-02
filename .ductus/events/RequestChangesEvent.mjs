import Ductus from 'ductus'
import RejectionSchema from '../schemas/RejectionSchema.mjs';

export default Ductus.event('ResolveReviewCommentsEvent')
    .payload(RejectionSchema)
