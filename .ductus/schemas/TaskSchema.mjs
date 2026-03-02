import { Schema } from 'ductus'

export default Schema.object({
    description: Schema.string(),
    requirements: Schema.array(Schema.string()),
})
