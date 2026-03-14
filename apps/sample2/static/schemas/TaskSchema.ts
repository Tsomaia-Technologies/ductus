import Ductus from 'ductus'

export default Ductus.object({
  description: Ductus.string(),
  requirements: Ductus.array(Ductus.string()),
})
