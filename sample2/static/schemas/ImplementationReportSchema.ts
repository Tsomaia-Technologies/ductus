import Ductus from '../core.js'

const Check = Ductus.object({
  command: Ductus.string(),
  cwd: Ductus.string(),
  result: Ductus.object({
    success: Ductus.boolean(),
  }),
})

export default Ductus.object({
  summary: Ductus.string(),
  checks: Ductus.array(Check),
})
