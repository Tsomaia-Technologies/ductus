import { Schema } from 'ductus'

export default Schema.object({
    status: Schema.literal('rejected'),
    reason: Schema.string(),
})
