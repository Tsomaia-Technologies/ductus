import Ductus from '../core.js'

export default Ductus.object({
  description: Ductus.string(),
  requirements: Ductus.array(Ductus.string()),
})
