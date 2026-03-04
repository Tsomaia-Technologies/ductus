import Ductus from '../core.js'

export default Ductus.object({
  status: Ductus.literal('rejected'),
  reason: Ductus.string(),
})
