import { Schema } from 'ductus'

const Check = Schema.object({
    command: Schema.string(),
    cwd: Schema.string(),
    result: Schema.object(),
})

export default Schema.object({
    summary: Schema.string(),
    checks: Schema.array(Check),
})
