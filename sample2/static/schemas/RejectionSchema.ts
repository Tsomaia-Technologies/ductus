import Ductus from 'ductus'

export default Ductus.object({
  status: Ductus.literal('rejected'),
  reason: Ductus.string(),
})
